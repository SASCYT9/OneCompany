import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sitemapPath = path.join(root, ".next", "server", "app", "sitemap.xml.body");
const fallbackDir = path.join(root, "public", "catalog-fallback");
const manifestPath = path.join(fallbackDir, "manifest.json");
const serverAppDir = path.join(root, ".next", "server", "app");

assert.ok(fs.existsSync(sitemapPath), `Missing post-build sitemap: ${sitemapPath}`);
assert.ok(fs.existsSync(manifestPath), `Missing catalog fallback manifest: ${manifestPath}`);

const sitemapBytes = fs.statSync(sitemapPath).size;
assert.ok(sitemapBytes < 50 * 1024 * 1024, `Sitemap is ${sitemapBytes} bytes (limit: 50 MB)`);

const xml = fs.readFileSync(sitemapPath, "utf8");
const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
assert.ok(urlBlocks.length > 0, "Sitemap contains no URLs");
assert.ok(urlBlocks.length < 50_000, `Sitemap contains ${urlBlocks.length} URLs`);

const locations = new Set<string>();
for (const block of urlBlocks) {
  const location = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
  assert.ok(location, "Sitemap URL is missing <loc>");
  assert.ok(
    location.startsWith("https://onecompany.global/"),
    `Unexpected sitemap host: ${location}`
  );
  assert.ok(!/[?#]/.test(location), `Query/hash URL in sitemap: ${location}`);
  assert.ok(!locations.has(location), `Duplicate sitemap URL: ${location}`);
  locations.add(location);

  const hreflangs = new Set([...block.matchAll(/hreflang="([^"]+)"/g)].map((match) => match[1]));
  for (const required of ["uk", "en", "x-default"]) {
    assert.ok(hreflangs.has(required), `${location} is missing ${required} hreflang`);
  }
}

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
      sitemapUrls: locations.size,
      sitemapBytes,
      fallbackProducts: manifest.count,
      fallbackStores: Object.keys(manifest.stores).length,
      serverTraces: traces.length,
    },
    null,
    2
  )
);
