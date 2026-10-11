import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { verifySitemapArtifactXml } from "../src/lib/seoSitemapVerify";

const root = process.cwd();
const sitemapPath = path.join(root, ".next", "server", "app", "sitemap.xml.body");
const fallbackDir = path.join(root, "public", "catalog-fallback");
const manifestPath = path.join(fallbackDir, "manifest.json");
const serverAppDir = path.join(root, ".next", "server", "app");

assert.ok(fs.existsSync(sitemapPath), `Missing post-build sitemap: ${sitemapPath}`);
assert.ok(fs.existsSync(manifestPath), `Missing catalog fallback manifest: ${manifestPath}`);

const sitemapBytes = fs.statSync(sitemapPath).size;
assert.ok(sitemapBytes < 50 * 1024 * 1024, `Sitemap is ${sitemapBytes} bytes (limit: 50 MB)`);

// `/sitemap.xml` is a sitemap index; its product children are rendered on demand
// and are not part of the build output (see src/lib/seoSitemapVerify.ts).
const sitemap = verifySitemapArtifactXml(fs.readFileSync(sitemapPath, "utf8"));

type FallbackManifest = {
  version: number;
  count: number;
  activeDatabaseCount: number;
  stores: Record<string, { file: string; count: number }>;
  slugToStore: Record<string, string>;
};

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as FallbackManifest;
assert.equal(manifest.version, 2);
assert.ok(
  manifest.count >= manifest.activeDatabaseCount,
  "Fallback is smaller than active DB count"
);
assert.equal(Object.keys(manifest.slugToStore).length, manifest.count, "Slug index count mismatch");

let shardCount = 0;
for (const [store, shard] of Object.entries(manifest.stores)) {
  const shardPath = path.join(fallbackDir, shard.file);
  assert.ok(fs.existsSync(shardPath), `Missing ${store} fallback shard: ${shard.file}`);
  const products = JSON.parse(fs.readFileSync(shardPath, "utf8")) as unknown[];
  assert.equal(products.length, shard.count, `${store} shard count mismatch`);
  shardCount += shard.count;
}
assert.equal(shardCount, manifest.count, "Store shard total does not match manifest");

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filePath) : [filePath];
  });
}

const traces = walk(serverAppDir).filter((file) => file.endsWith(".nft.json"));
assert.ok(traces.length > 0, "No Next.js server traces found");
for (const trace of traces) {
  const body = fs.readFileSync(trace, "utf8");
  assert.ok(!body.includes("shop-products.snapshot.json"), `Monolithic snapshot in ${trace}`);
  assert.ok(!body.includes("public/catalog-fallback"), `Public fallback duplicated in ${trace}`);
}

console.log(
  JSON.stringify(
    {
      sitemap,
      sitemapBytes,
      fallbackProducts: manifest.count,
      fallbackStores: Object.keys(manifest.stores).length,
      serverTraces: traces.length,
    },
    null,
    2
  )
);
