import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  replaceCatalogDirectoryAtomically,
  replaceFileAtomically,
} from "./atomic-catalog-directory";

/**
 * Build artifact cache for the generated storefront catalog.
 *
 * The cache is deliberately opt-in: a caller must provide an immutable
 * publication key.  A cache entry without that key could serve a previous
 * database state after a product or price change, which is worse than the
 * build cost this helper is meant to avoid.
 */
export const CATALOG_BUILD_ARTIFACT_VERSION = 1 as const;
export const CATALOG_FILTER_INDEX_KEYS = [
  "adro",
  "brabus",
  "burger",
  "csf",
  "girodisc",
  "ipe",
  "ohlins",
  "racechip",
] as const;
export const DEFAULT_CATALOG_BUILD_CACHE_DIR = path.join(
  ".next",
  "cache",
  "one-company-catalog-v2"
);

type ArtifactFile = {
  relativePath: string;
  bytes: number;
  sha256: string;
};

export type CatalogBuildArtifactManifest = {
  version: typeof CATALOG_BUILD_ARTIFACT_VERSION;
  key: string;
  generatedAt: string;
  files: readonly ArtifactFile[];
  productCount: number;
  activeDatabaseCount: number;
};

export type CatalogBuildArtifactPaths = {
  productsOutput: string;
  settingsOutput: string;
  fallbackOutputDir: string;
  /** Generated filter indexes are part of the same immutable build bundle. */
  indexOutputDir?: string;
};

type CacheResult = {
  manifest: CatalogBuildArtifactManifest;
  cacheDir: string;
};

function normalizedKey(value: string | undefined) {
  const key = value?.trim() ?? "";
  if (!key) return null;
  if (key.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new TypeError(
      "CATALOG_BUILD_ARTIFACT_KEY must be 1..256 characters from A-Z, a-z, 0-9, dot, underscore, colon, or hyphen"
    );
  }
  return key;
}

function canonicalRelativePath(value: string) {
  return value.replaceAll("\\", "/");
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function resolveCatalogBuildCacheDir(input?: { cwd?: string; configuredDir?: string }) {
  const cwd = input?.cwd ?? process.cwd();
  const configured = input?.configuredDir?.trim();
  return path.resolve(cwd, configured || DEFAULT_CATALOG_BUILD_CACHE_DIR);
}

export function readCatalogBuildArtifactKey(value = process.env.CATALOG_BUILD_ARTIFACT_KEY) {
  return normalizedKey(value);
}

function sha256File(file: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function relativeFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory())
      return relativeFiles(entryPath).map((file) => path.join(entry.name, file));
    if (entry.isFile()) return [entry.name];
    return [];
  });
}

function assertContained(root: string, relativePath: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Catalog build artifact path escapes cache root: ${relativePath}`);
  }
  return resolved;
}

function readManifest(cacheDir: string): CatalogBuildArtifactManifest | null {
  const manifestPath = path.join(cacheDir, "artifact-manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Partial<CatalogBuildArtifactManifest>;
  const productCount = value.productCount;
  const activeDatabaseCount = value.activeDatabaseCount;
  if (
    value.version !== CATALOG_BUILD_ARTIFACT_VERSION ||
    typeof value.key !== "string" ||
    !value.key ||
    !Array.isArray(value.files) ||
    !isSafeInteger(productCount) ||
    !isSafeInteger(activeDatabaseCount) ||
    productCount < 1 ||
    activeDatabaseCount < 0 ||
    productCount < activeDatabaseCount
  ) {
    return null;
  }
  try {
    normalizedKey(value.key);
  } catch {
    return null;
  }
  const files = value.files.filter(
    (file): file is ArtifactFile =>
      !!file &&
      typeof file === "object" &&
      typeof file.relativePath === "string" &&
      isSafeInteger(file.bytes) &&
      file.bytes >= 0 &&
      typeof file.sha256 === "string" &&
      /^[a-f0-9]{64}$/i.test(file.sha256)
  );
  if (files.length !== value.files.length || !files.length) return null;
  return {
    version: CATALOG_BUILD_ARTIFACT_VERSION,
    key: value.key,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    files,
    productCount,
    activeDatabaseCount,
  };
}

function verifyArtifactFiles(
  cacheDir: string,
  manifest: CatalogBuildArtifactManifest,
  expectedKey: string,
  options?: { requireIndexes?: boolean }
) {
  if (manifest.key !== expectedKey) return false;
  const names = new Set<string>();
  for (const file of manifest.files) {
    const relativePath = canonicalRelativePath(file.relativePath);
    if (names.has(relativePath)) return false;
    names.add(relativePath);
    let absolute: string;
    try {
      absolute = assertContained(cacheDir, relativePath);
    } catch {
      return false;
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return false;
    const stat = fs.statSync(absolute);
    if (stat.size !== file.bytes || sha256File(absolute) !== file.sha256) return false;
  }
  const products = manifest.files.find(
    (file) => canonicalRelativePath(file.relativePath) === "data/shop-products.snapshot.json"
  );
  const fallbackManifest = manifest.files.find(
    (file) => canonicalRelativePath(file.relativePath) === "public/catalog-fallback/manifest.json"
  );
  const indexManifest = manifest.files.find(
    (file) => canonicalRelativePath(file.relativePath) === "public/catalog-index/manifest.json"
  );
  return !!products && !!fallbackManifest && (!options?.requireIndexes || !!indexManifest);
}

function validateSnapshotShape(cacheDir: string, manifest: CatalogBuildArtifactManifest) {
  try {
    const productsPath = assertContained(cacheDir, "data/shop-products.snapshot.json");
    const products = JSON.parse(fs.readFileSync(productsPath, "utf8")) as unknown;
    if (!Array.isArray(products) || products.length !== manifest.productCount) return false;
    const fallbackPath = assertContained(cacheDir, "public/catalog-fallback/manifest.json");
    const fallback = JSON.parse(fs.readFileSync(fallbackPath, "utf8")) as {
      version?: number;
      count?: number;
      activeDatabaseCount?: number;
      stores?: Record<string, { file?: string; count?: number }>;
    };
    if (
      fallback.version !== 2 ||
      fallback.count !== manifest.productCount ||
      fallback.activeDatabaseCount !== manifest.activeDatabaseCount ||
      !fallback.stores
    )
      return false;
    for (const entry of Object.values(fallback.stores)) {
      const count = entry.count;
      if (!entry.file || !isSafeInteger(count) || count < 0) return false;
      const shardPath = assertContained(cacheDir, path.join("public/catalog-fallback", entry.file));
      if (!fs.existsSync(shardPath) || !fs.statSync(shardPath).isFile()) return false;
      const shard = JSON.parse(fs.readFileSync(shardPath, "utf8")) as unknown;
      if (!Array.isArray(shard) || shard.length !== count) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validateIndexShape(cacheDir: string, manifest: CatalogBuildArtifactManifest) {
  try {
    const manifestPath = assertContained(cacheDir, "public/catalog-index/manifest.json");
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      indexes?: Record<string, { file?: string; count?: number }>;
    };
    const indexes = parsed.indexes;
    if (
      !indexes ||
      typeof indexes !== "object" ||
      Object.keys(indexes).length !== CATALOG_FILTER_INDEX_KEYS.length ||
      CATALOG_FILTER_INDEX_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(indexes, key))
    )
      return false;

    for (const entry of Object.values(indexes)) {
      if (
        !entry ||
        typeof entry.file !== "string" ||
        !isSafeInteger(entry.count) ||
        entry.count < 0
      )
        return false;
      const shardPath = assertContained(cacheDir, path.join("public/catalog-index", entry.file));
      if (!fs.existsSync(shardPath) || !fs.statSync(shardPath).isFile()) return false;
      const shard = JSON.parse(fs.readFileSync(shardPath, "utf8")) as unknown;
      if (!Array.isArray(shard) || shard.length !== entry.count) return false;
      const expectedHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(shard))
        .digest("hex")
        .slice(0, 12);
      if (!entry.file.endsWith(`.${expectedHash}.json`)) return false;
    }

    // Every file declared by the index manifest must be included in the
    // outer content-addressed manifest. This prevents restoring an index that
    // was written after the artifact manifest or was copied only partially.
    const artifactFiles = new Set(
      manifest.files.map((file) => canonicalRelativePath(file.relativePath))
    );
    if (!artifactFiles.has("public/catalog-index/manifest.json")) return false;
    return Object.values(indexes).every((entry) =>
      artifactFiles.has(`public/catalog-index/${entry.file}`)
    );
  } catch {
    return false;
  }
}

function copyArtifactFile(cacheDir: string, relativePath: string, destination: string) {
  const source = assertContained(cacheDir, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function stageDirectoryFromCache(cacheDir: string, relativeDirectory: string, parent: string) {
  const source = assertContained(cacheDir, relativeDirectory);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`Catalog build artifact directory is missing: ${relativeDirectory}`);
  }
  const staged = fs.mkdtempSync(path.join(parent, ".catalog-fallback-cache-"));
  fs.cpSync(source, staged, { recursive: true });
  return staged;
}

/** Restore a fully verified artifact. Returns null for a cache miss. */
export function restoreCatalogBuildArtifact(input: {
  cacheDir: string;
  key: string;
  paths: CatalogBuildArtifactPaths;
}): CacheResult | null {
  const key = normalizedKey(input.key);
  if (!key) return null;
  const cacheDir = path.resolve(input.cacheDir);
  const manifest = readManifest(cacheDir);
  if (
    !manifest ||
    !verifyArtifactFiles(cacheDir, manifest, key) ||
    !validateSnapshotShape(cacheDir, manifest)
  ) {
    return null;
  }

  copyArtifactFile(cacheDir, "data/shop-products.snapshot.json", input.paths.productsOutput);
  const settingsPath = assertContained(cacheDir, "data/shop-settings.snapshot.json");
  if (fs.existsSync(settingsPath))
    copyArtifactFile(cacheDir, "data/shop-settings.snapshot.json", input.paths.settingsOutput);
  const stagedFallback = stageDirectoryFromCache(
    cacheDir,
    "public/catalog-fallback",
    path.dirname(path.resolve(input.paths.fallbackOutputDir))
  );
  try {
    replaceCatalogDirectoryAtomically(stagedFallback, input.paths.fallbackOutputDir);
  } finally {
    if (fs.existsSync(stagedFallback)) fs.rmSync(stagedFallback, { recursive: true, force: true });
  }
  return { manifest, cacheDir };
}

/**
 * Restore only the generated filter indexes from a complete artifact.
 *
 * The snapshot stage runs first and owns the products/settings/fallback
 * outputs. Keeping this operation separate avoids copying the large snapshot
 * a second time just to reuse the indexes.
 */
export function restoreCatalogBuildArtifactIndexes(input: {
  cacheDir: string;
  key: string;
  outputDir: string;
}): CacheResult | null {
  const key = normalizedKey(input.key);
  if (!key) return null;
  const cacheDir = path.resolve(input.cacheDir);
  const manifest = readManifest(cacheDir);
  if (
    !manifest ||
    !verifyArtifactFiles(cacheDir, manifest, key, { requireIndexes: true }) ||
    !validateSnapshotShape(cacheDir, manifest) ||
    !validateIndexShape(cacheDir, manifest)
  ) {
    return null;
  }

  const staged = stageDirectoryFromCache(
    cacheDir,
    "public/catalog-index",
    path.dirname(path.resolve(input.outputDir))
  );
  try {
    // The staged directory has already passed the manifest/hash checks. Use
    // a sibling rename so readers never observe a half-written index set.
    const target = path.resolve(input.outputDir);
    const backup = `${target}.backup-${process.pid}-${Date.now()}`;
    const hadTarget = fs.existsSync(target);
    try {
      if (hadTarget) fs.renameSync(target, backup);
      fs.renameSync(staged, target);
      if (hadTarget) fs.rmSync(backup, { recursive: true, force: true });
    } catch (error) {
      if (!fs.existsSync(target) && hadTarget && fs.existsSync(backup))
        fs.renameSync(backup, target);
      throw error;
    }
  } finally {
    if (fs.existsSync(staged)) fs.rmSync(staged, { recursive: true, force: true });
  }
  return { manifest, cacheDir };
}

/** Save outputs after the database-backed generation succeeded. */
export function saveCatalogBuildArtifact(input: {
  cacheDir: string;
  key: string;
  paths: CatalogBuildArtifactPaths;
  productCount: number;
  activeDatabaseCount: number;
}) {
  const key = normalizedKey(input.key);
  if (!key) return null;
  if (!fs.existsSync(input.paths.productsOutput) || !fs.existsSync(input.paths.fallbackOutputDir)) {
    throw new Error("Cannot cache catalog build artifact before generated outputs exist");
  }
  const cacheDir = path.resolve(input.cacheDir);
  const entries: Array<[string, string]> = [
    ["data/shop-products.snapshot.json", input.paths.productsOutput],
  ];
  if (fs.existsSync(input.paths.settingsOutput)) {
    entries.push(["data/shop-settings.snapshot.json", input.paths.settingsOutput]);
  }
  for (const relative of relativeFiles(input.paths.fallbackOutputDir)) {
    entries.push([
      canonicalRelativePath(path.join("public/catalog-fallback", relative)),
      path.join(input.paths.fallbackOutputDir, relative),
    ]);
  }
  if (input.paths.indexOutputDir && fs.existsSync(input.paths.indexOutputDir)) {
    for (const relative of relativeFiles(input.paths.indexOutputDir)) {
      entries.push([
        canonicalRelativePath(path.join("public/catalog-index", relative)),
        path.join(input.paths.indexOutputDir, relative),
      ]);
    }
  }
  const files: ArtifactFile[] = [];
  for (const [relativePath, source] of entries) {
    const stat = fs.statSync(source);
    if (!stat.isFile()) throw new Error(`Catalog build artifact source is not a file: ${source}`);
    files.push({ relativePath, bytes: stat.size, sha256: sha256File(source) });
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const [relativePath, source] of entries) {
    const destination = assertContained(cacheDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  const manifest: CatalogBuildArtifactManifest = {
    version: CATALOG_BUILD_ARTIFACT_VERSION,
    key,
    generatedAt: new Date().toISOString(),
    files,
    productCount: input.productCount,
    activeDatabaseCount: input.activeDatabaseCount,
  };
  replaceFileAtomically(path.join(cacheDir, "artifact-manifest.json"), JSON.stringify(manifest));
  return { manifest, cacheDir };
}
