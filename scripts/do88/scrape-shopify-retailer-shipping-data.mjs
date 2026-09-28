#!/usr/bin/env node

/**
 * Read-only exact-SKU shipping-weight lookup from ML Performance's public
 * Shopify search + Ajax Product API. Shopify Liquid's variant.weight is grams.
 * Only DO88-vendor products and exact variant-SKU matches are retained.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/scrape-shopify-retailer-shipping-data.mjs input.json output.json
 * Input: [{ "sku": "..." }]
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Pass input.json and output.json paths");
const targets = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(targets) || targets.some((item) => !item?.sku)) throw new Error("Input must be an array of objects with sku");

const BASE = "https://www.mlperformance.co.uk";
const CONCURRENCY = 8;
const MAX_DETAIL_CANDIDATES = 5;
const results = new Array(targets.length);
const errors = [];
let next = 0;

function canonicalSku(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizedDo88RetailerSku(value) {
  return canonicalSku(value).replace(/^DO88-/, "");
}

function hasSkuToken(text, sku) {
  const escaped = String(sku).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:$|[^A-Za-z0-9])`, "i").test(String(text ?? ""));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "OneCompany-Do88-Shipping-Audit/1.0" }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function lookup(target) {
  const searchUrl = new URL("/search/suggest.json", BASE);
  searchUrl.searchParams.set("q", target.sku);
  searchUrl.searchParams.set("resources[type]", "product");
  searchUrl.searchParams.set("resources[limit]", "10");
  const search = await fetchJson(searchUrl.toString());
  const products = search?.resources?.results?.products;
  if (!Array.isArray(products)) throw new Error("Shopify predictive search returned an unexpected result shape");
  const candidates = products
    .filter((product) => String(product.vendor ?? "").trim().toLowerCase() === "do88")
    .filter((product) => hasSkuToken(product.title, target.sku) || hasSkuToken(product.body, target.sku) || hasSkuToken(product.handle, target.sku))
    .slice(0, MAX_DETAIL_CANDIDATES);
  if (!candidates.length) return { requestedSku: target.sku, exactSkuMatches: [], sourceSearchUrl: searchUrl.toString() };

  const matches = [];
  for (const candidate of candidates) {
    const detailUrl = new URL(`/products/${candidate.handle}.js`, BASE);
    const detail = await fetchJson(detailUrl.toString());
    for (const variant of detail.variants ?? []) {
      const retailerSku = String(variant.sku ?? "").trim();
      if (!retailerSku || normalizedDo88RetailerSku(retailerSku) !== normalizedDo88RetailerSku(target.sku)) continue;
      const weightGrams = Number(variant.weight);
      matches.push({
        requestedSku: target.sku,
        retailerSku,
        matchType: canonicalSku(retailerSku) === canonicalSku(target.sku) ? "exact_sku" : "do88_prefix_alias_exact_base_sku",
        vendor: detail.vendor ?? candidate.vendor ?? null,
        productTitle: detail.title ?? candidate.title,
        retailerHandle: detail.handle ?? candidate.handle,
        retailerPageUrl: new URL(`/products/${detail.handle ?? candidate.handle}`, BASE).toString(),
        weightGrams: Number.isFinite(weightGrams) && weightGrams > 0 ? weightGrams : null,
        weightKg: Number.isFinite(weightGrams) && weightGrams > 0 ? Math.round((weightGrams / 1000) * 1000) / 1000 : null,
        shopifyWeightUnitEvidence: "Ajax Product API variant.weight; Shopify Liquid documents variant.weight in grams",
        productDimensions: null,
      });
    }
  }
  return { requestedSku: target.sku, exactSkuMatches: matches, sourceSearchUrl: searchUrl.toString() };
}

async function worker() {
  while (true) {
    const index = next++;
    if (index >= targets.length) return;
    try { results[index] = await lookup(targets[index]); }
    catch (error) { errors.push({ sku: targets[index].sku, error: String(error) }); }
    if ((index + 1) % 50 === 0 || index + 1 === targets.length) {
      const items = results.filter(Boolean).flatMap((result) => result.exactSkuMatches ?? []);
      console.log(`Searched ${index + 1}/${targets.length}; exact variant matches ${items.length}; nonzero weights ${items.filter((item) => item.weightKg != null).length}; lookup errors ${errors.length}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
const records = results.filter(Boolean);
const flat = records.flatMap((record) => record.exactSkuMatches ?? []);
const bySku = new Map();
for (const record of flat) {
  const key = canonicalSku(record.requestedSku);
  const rows = bySku.get(key) ?? [];
  rows.push(record);
  bySku.set(key, rows);
}
const conflicts = [...bySku.entries()].filter(([, rows]) => new Set(rows.map((row) => row.weightKg)).size > 1).map(([sku, rows]) => ({ sku, valuesKg: [...new Set(rows.map((row) => row.weightKg))], matches: rows }));
const output = {
  source: "ML Performance public Shopify product search/Ajax Product API",
  retrievedAt: new Date().toISOString(),
  requested: targets.length,
  queried: records.length,
  exactVariantMatches: flat.length,
  uniqueSkusWithWeight: new Set(flat.filter((item) => item.weightKg != null).map((item) => canonicalSku(item.requestedSku))).size,
  duplicateOrConflictingSkuGroups: [...bySku.values()].filter((rows) => rows.length > 1).length,
  conflictingWeights: conflicts,
  errors,
  products: records,
};
const resolved = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolved), { recursive: true });
await fs.writeFile(resolved, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: resolved, requested: output.requested, exactVariantMatches: output.exactVariantMatches, uniqueSkusWithWeight: output.uniqueSkusWithWeight, duplicateOrConflictingSkuGroups: output.duplicateOrConflictingSkuGroups, conflictingWeights: conflicts.length, errors: errors.length }, null, 2));
