/**
 * Read-only fetch of explicit do88 English Europe product pages for content review.
 * Extracts the official Product JSON-LD description and SKU evidence.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/scrape-eu-product-content-review.mjs input.json output.json
 * Input: [{ "sku": "...", "storeSku": "...", "sourceUrl": "https://www.do88performance.eu/en/artiklar/...html" }]
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Pass input.json and output.json paths");
const targets = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(targets) || targets.some((row) => !row?.sku || !row?.storeSku || !row?.sourceUrl)) {
  throw new Error("Input must be an array of rows with sku, storeSku and sourceUrl");
}

const BASE = "https://www.do88performance.eu";
const COOKIE = "VALUTA=EUR; SPRAK=EN; MOMS=inkl.";
const CONCURRENCY = 5;
const results = new Array(targets.length);
const errors = [];
let nextIndex = 0;

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#160;|&nbsp;/g, " ").replace(/&#8211;/g, "–").replace(/&#8217;/g, "’")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

function collectProducts(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectProducts(item, output);
  } else if (value && typeof value === "object") {
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.includes("Product")) output.push(value);
    for (const [key, child] of Object.entries(value)) {
      if (key !== "brand" && child && typeof child === "object") collectProducts(child, output);
    }
  }
  return output;
}

function parsePage(html, target) {
  const pageSku = html.match(/<input[^>]+name="altnr"[^>]+value="([^"]+)"/)?.[1] ?? null;
  const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const products = [];
  for (const block of jsonLdBlocks) {
    try { collectProducts(JSON.parse(block[1]), products); } catch { /* skip non-JSON scripts */ }
  }
  const product = products.find((item) => item.description) ?? products[0] ?? null;
  const jsonLdSku = product?.sku ?? product?.mpn ?? null;
  let descriptionEn = decodeHtml(product?.description ?? "").replace(/\s+/g, " ").trim();
  if (!descriptionEn) {
    const marker = "Product description</summary>";
    const start = html.indexOf(marker);
    if (start >= 0) {
      const tail = html.slice(start + marker.length);
      const nextSummary = tail.indexOf("<summary");
      const section = nextSummary >= 0 ? tail.slice(0, nextSummary) : tail.slice(0, 20000);
      descriptionEn = decodeHtml(section.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
        .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
    }
  }
  const titleEn = decodeHtml(product?.name ?? "").replace(/\s+/g, " ").trim();
  const brand = typeof product?.brand === "string" ? product.brand : product?.brand?.name ?? null;
  return {
    requestedSku: target.sku,
    storeSku: target.storeSku,
    sourceUrl: target.sourceUrl,
    pageSku,
    jsonLdSku,
    skuMatch: [pageSku, jsonLdSku].some((sku) => sku && sku.toLowerCase() === target.sku.toLowerCase()),
    titleEn,
    brand,
    descriptionEn: descriptionEn || null,
  };
}

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= targets.length) return;
    const target = targets[index];
    try {
      const url = new URL(target.sourceUrl);
      if (url.hostname !== "www.do88performance.eu" || !url.pathname.startsWith("/en/artiklar/")) {
        throw new Error(`Refusing non-Do88 EU product URL: ${target.sourceUrl}`);
      }
      const response = await fetch(url, {
        headers: { "User-Agent": "OneCompany-DO88-Content-Audit/1.0", Cookie: COOKIE },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      results[index] = parsePage(await response.text(), target);
    } catch (error) {
      errors.push({ sku: target.sku, storeSku: target.storeSku, sourceUrl: target.sourceUrl, error: String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    if ((index + 1) % 50 === 0 || index + 1 === targets.length) {
      console.log(`Fetched ${index + 1}/${targets.length}; descriptions ${results.filter((row) => row?.descriptionEn).length}; errors ${errors.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
const output = {
  sourceMode: "English Europe; EUR / Customer / Incl. VAT session",
  retrievedAt: new Date().toISOString(),
  requested: targets.length,
  descriptionsFound: results.filter((row) => row?.descriptionEn).length,
  skuEvidenceMatches: results.filter((row) => row?.skuMatch).length,
  errors,
  products: results.filter(Boolean),
};
const resolvedOutput = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
await fs.writeFile(resolvedOutput, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify({ output: resolvedOutput, requested: output.requested, descriptionsFound: output.descriptionsFound, skuEvidenceMatches: output.skuEvidenceMatches, errors: errors.length }));
