import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  readCatalogBuildArtifactKey,
  restoreCatalogBuildArtifact,
  saveCatalogBuildArtifact,
} from "../../../scripts/lib/catalog-build-artifact";

const PRODUCT_COUNT = 10_000;

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "catalog-build-artifact-"));
  const paths = {
    productsOutput: path.join(root, "data", "shop-products.snapshot.json"),
    settingsOutput: path.join(root, "data", "shop-settings.snapshot.json"),
    fallbackOutputDir: path.join(root, "public", "catalog-fallback"),
  };
  mkdirSync(path.dirname(paths.productsOutput), { recursive: true });
  mkdirSync(paths.fallbackOutputDir, { recursive: true });
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
  return { root, paths };
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

test("artifact keys reject unsafe path characters", () => {
  assert.throws(() => readCatalogBuildArtifactKey("../catalog"), /CATALOG_BUILD_ARTIFACT_KEY/);
});
