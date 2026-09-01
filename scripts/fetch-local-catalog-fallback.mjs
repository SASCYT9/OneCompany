import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const origin = "https://onecompany.global";
const targetDir = path.resolve("public", "catalog-fallback");
const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "onecompany-catalog-"));
const targetIndexDir = path.resolve("public", "catalog-index");
const temporaryIndexDir = fs.mkdtempSync(path.join(os.tmpdir(), "onecompany-catalog-index-"));

async function fetchJson(directory, file) {
  const response = await fetch(`${origin}/${directory}/${encodeURIComponent(file)}`);
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
  const manifestBuffer = await fetchJson("catalog-fallback", "manifest.json");
  const manifest = parseJson(manifestBuffer, "manifest.json");

  if (manifest.version !== 2 || !manifest.stores || !manifest.slugToStore) {
    throw new Error("The public catalog manifest is missing the expected version-2 shape");
  }

  fs.writeFileSync(path.join(temporaryDir, "manifest.json"), manifestBuffer);

  let downloaded = 0;
  for (const [store, entry] of Object.entries(manifest.stores)) {
    const buffer = await fetchJson("catalog-fallback", entry.file);
    const products = parseJson(buffer, entry.file);
    if (!Array.isArray(products) || products.length !== entry.count) {
      throw new Error(`${store} shard count mismatch: expected ${entry.count}`);
    }
    fs.writeFileSync(path.join(temporaryDir, entry.file), buffer);
    downloaded += products.length;
    console.log(`[catalog] ${store}: ${products.length} products`);
  }

  const sitemapBuffer = await fetchJson("catalog-fallback", "sitemap.json");
  const sitemap = parseJson(sitemapBuffer, "sitemap.json");
  if (!Array.isArray(sitemap)) {
    throw new Error("sitemap.json is not an array");
  }
  fs.writeFileSync(path.join(temporaryDir, "sitemap.json"), sitemapBuffer);

  if (downloaded !== manifest.count) {
    throw new Error(`Catalog count mismatch: expected ${manifest.count}, got ${downloaded}`);
  }

  const indexManifestBuffer = await fetchJson("catalog-index", "manifest.json");
  const indexManifest = parseJson(indexManifestBuffer, "catalog-index/manifest.json");
  if (!indexManifest.indexes || typeof indexManifest.indexes !== "object") {
    throw new Error("The public catalog index manifest is missing indexes");
  }
  fs.writeFileSync(path.join(temporaryIndexDir, "manifest.json"), indexManifestBuffer);
  for (const [key, entry] of Object.entries(indexManifest.indexes)) {
    if (!entry || typeof entry.file !== "string" || !Number.isSafeInteger(entry.count)) {
      throw new Error(`Invalid catalog index descriptor for ${key}`);
    }
    const buffer = await fetchJson("catalog-index", entry.file);
    const products = parseJson(buffer, `catalog-index/${entry.file}`);
    if (!Array.isArray(products) || products.length !== entry.count) {
      throw new Error(`${key} index count mismatch: expected ${entry.count}`);
    }
    fs.writeFileSync(path.join(temporaryIndexDir, entry.file), buffer);
    console.log(`[catalog-index] ${key}: ${products.length} products`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.renameSync(temporaryDir, targetDir);
  fs.rmSync(targetIndexDir, { recursive: true, force: true });
  fs.renameSync(temporaryIndexDir, targetIndexDir);
  console.log(`[catalog] installed ${downloaded} products in ${targetDir}`);
}

main().catch((error) => {
  fs.rmSync(temporaryDir, { recursive: true, force: true });
  fs.rmSync(temporaryIndexDir, { recursive: true, force: true });
  console.error(`[catalog] failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
