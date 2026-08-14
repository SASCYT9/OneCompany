import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const origin = "https://onecompany.global";
const targetDir = path.resolve("public", "catalog-fallback");
const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "onecompany-catalog-"));

async function fetchJson(file) {
  const response = await fetch(`${origin}/catalog-fallback/${encodeURIComponent(file)}`);
  if (!response.ok) {
    throw new Error(`${file} returned HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function parseJson(buffer, file) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  const manifestBuffer = await fetchJson("manifest.json");
  const manifest = parseJson(manifestBuffer, "manifest.json");

  if (manifest.version !== 2 || !manifest.stores || !manifest.slugToStore) {
    throw new Error("The public catalog manifest is missing the expected version-2 shape");
  }

  fs.writeFileSync(path.join(temporaryDir, "manifest.json"), manifestBuffer);

  let downloaded = 0;
  for (const [store, entry] of Object.entries(manifest.stores)) {
    const buffer = await fetchJson(entry.file);
    const products = parseJson(buffer, entry.file);
    if (!Array.isArray(products) || products.length !== entry.count) {
      throw new Error(`${store} shard count mismatch: expected ${entry.count}`);
    }
    fs.writeFileSync(path.join(temporaryDir, entry.file), buffer);
    downloaded += products.length;
    console.log(`[catalog] ${store}: ${products.length} products`);
  }

  const sitemapBuffer = await fetchJson("sitemap.json");
  const sitemap = parseJson(sitemapBuffer, "sitemap.json");
  if (!Array.isArray(sitemap)) {
    throw new Error("sitemap.json is not an array");
  }
  fs.writeFileSync(path.join(temporaryDir, "sitemap.json"), sitemapBuffer);

  if (downloaded !== manifest.count) {
    throw new Error(`Catalog count mismatch: expected ${manifest.count}, got ${downloaded}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.renameSync(temporaryDir, targetDir);
  console.log(`[catalog] installed ${downloaded} products in ${targetDir}`);
}

main().catch((error) => {
  fs.rmSync(temporaryDir, { recursive: true, force: true });
  console.error(`[catalog] failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
