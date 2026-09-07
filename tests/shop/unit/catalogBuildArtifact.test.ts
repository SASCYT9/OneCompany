import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  readCatalogBuildArtifactKey,
  restoreCatalogBuildArtifact,
  restoreCatalogBuildArtifactIndexes,
  saveCatalogBuildArtifact,
} from "../../../scripts/lib/catalog-build-artifact";

const PRODUCT_COUNT = 10_000;

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "catalog-build-artifact-"));
  const paths = {
    productsOutput: path.join(root, "data", "shop-products.snapshot.json"),
    settingsOutput: path.join(root, "data", "shop-settings.snapshot.json"),
    fallbackOutputDir: path.join(root, "public", "catalog-fallback"),
    indexOutputDir: path.join(root, "public", "catalog-index"),
  };
  mkdirSync(path.dirname(paths.productsOutput), { recursive: true });
  mkdirSync(paths.fallbackOutputDir, { recursive: true });
  mkdirSync(paths.indexOutputDir, { recursive: true });
  writeFileSync(
    paths.productsOutput,
    JSON.stringify(Array.from({ length: PRODUCT_COUNT }, (_, id) => ({ id })))
  );
  writeFileSync(paths.settingsOutput, JSON.stringify({ key: "shop" }));
  writeFileSync(
    path.join(paths.fallbackOutputDir, "generic.json"),
    JSON.stringify(Array.from({ length: PRODUCT_COUNT }, (_, id) => ({ id })))
  );
  writeFileSync(path.join(paths.fallbackOutputDir, "sitemap.json"), "[]");
  writeFileSync(
    path.join(paths.fallbackOutputDir, "manifest.json"),
    JSON.stringify({
      version: 2,
      count: PRODUCT_COUNT,
      activeDatabaseCount: PRODUCT_COUNT,
      stores: { generic: { file: "generic.json", count: PRODUCT_COUNT } },
      slugToStore: {},
    })
  );
  const indexRows = [{ slug: "fixture-product" }];
  const indexJson = JSON.stringify(indexRows);
  const indexHash = awaitableHash(indexJson);
  const indexKeys = ["adro", "brabus", "burger", "csf", "girodisc", "ipe", "ohlins", "racechip"];
  const indexes = Object.fromEntries(
    indexKeys.map((key) => {
      const file = `${key}.${indexHash}.json`;
      writeFileSync(path.join(paths.indexOutputDir, file), indexJson);
      return [key, { file, count: 1 }];
    })
  );
  writeFileSync(
    path.join(paths.indexOutputDir, "manifest.json"),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      indexes,
    })
  );
  return { root, paths };
}

function awaitableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

test("artifact cache is opt-in and rejects an absent key", () => {
  assert.equal(readCatalogBuildArtifactKey(""), null);
  assert.equal(readCatalogBuildArtifactKey(undefined), null);
});

test("a keyed artifact restores verified snapshots without a database read", () => {
  const source = fixture();
  const cacheDir = path.join(source.root, "cache");
  try {
    const saved = saveCatalogBuildArtifact({
      cacheDir,
      key: "sha256:catalog-v1",
      paths: source.paths,
      productCount: PRODUCT_COUNT,
      activeDatabaseCount: PRODUCT_COUNT,
    });
    assert.equal(saved?.manifest.productCount, PRODUCT_COUNT);
    rmSync(source.paths.productsOutput);
    rmSync(source.paths.settingsOutput);
    rmSync(source.paths.fallbackOutputDir, { recursive: true });
    rmSync(source.paths.indexOutputDir, { recursive: true });

    const restored = restoreCatalogBuildArtifact({
      cacheDir,
      key: "sha256:catalog-v1",
      paths: source.paths,
    });
    assert.equal(restored?.manifest.key, "sha256:catalog-v1");
    assert.equal(
      JSON.parse(readFileSync(source.paths.productsOutput, "utf8")).length,
      PRODUCT_COUNT
    );
    assert.equal(existsSync(path.join(source.paths.fallbackOutputDir, "manifest.json")), true);
    const restoredIndexes = restoreCatalogBuildArtifactIndexes({
      cacheDir,
      key: "sha256:catalog-v1",
      outputDir: source.paths.indexOutputDir,
    });
    assert.equal(restoredIndexes?.manifest.key, "sha256:catalog-v1");
    assert.equal(existsSync(path.join(source.paths.indexOutputDir, "manifest.json")), true);
  } finally {
    rmSync(source.root, { recursive: true, force: true });
  }
});

test("wrong keys and tampered shards are cache misses", () => {
  const source = fixture();
  const cacheDir = path.join(source.root, "cache");
  try {
    saveCatalogBuildArtifact({
      cacheDir,
      key: "sha256:catalog-v1",
      paths: source.paths,
      productCount: PRODUCT_COUNT,
      activeDatabaseCount: PRODUCT_COUNT,
    });
    assert.equal(
      restoreCatalogBuildArtifact({ cacheDir, key: "sha256:catalog-v2", paths: source.paths }),
      null
    );
    writeFileSync(path.join(cacheDir, "public", "catalog-fallback", "generic.json"), "tampered");
    assert.equal(
      restoreCatalogBuildArtifact({ cacheDir, key: "sha256:catalog-v1", paths: source.paths }),
      null
    );
  } finally {
    rmSync(source.root, { recursive: true, force: true });
  }
});

test("missing or tampered filter indexes never restore", () => {
  const source = fixture();
  const cacheDir = path.join(source.root, "cache");
  try {
    saveCatalogBuildArtifact({
      cacheDir,
      key: "sha256:catalog-v1",
      paths: source.paths,
      productCount: PRODUCT_COUNT,
      activeDatabaseCount: PRODUCT_COUNT,
    });
    rmSync(path.join(cacheDir, "public", "catalog-index", "manifest.json"));
    assert.equal(
      restoreCatalogBuildArtifactIndexes({
        cacheDir,
        key: "sha256:catalog-v1",
        outputDir: source.paths.indexOutputDir,
      }),
      null
    );
  } finally {
    rmSync(source.root, { recursive: true, force: true });
  }
});

test("artifact keys reject unsafe path characters", () => {
  assert.throws(() => readCatalogBuildArtifactKey("../catalog"), /CATALOG_BUILD_ARTIFACT_KEY/);
});
