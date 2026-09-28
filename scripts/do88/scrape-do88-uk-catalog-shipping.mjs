#!/usr/bin/env node

/** Read-only page-by-page export of DO88-labelled products from do88.co.uk's WooCommerce Store API. */
import fs from "node:fs/promises";
import path from "node:path";

const [, , outputPath] = process.argv;
if (!outputPath) throw new Error("Usage: node scrape-do88-uk-catalog-shipping.mjs <output.json>");

const BASE = "https://www.do88.co.uk";
const PER_PAGE = 100;
const products = [];
let totalPages = 1;

for (let page = 1; page <= totalPages; page += 1) {
  const url = new URL("/wp-json/wc/store/v1/products", BASE);
  url.searchParams.set("search", "do88");
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OneCompany-Do88-Shipping-Audit/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`WooCommerce Store API returned HTTP ${response.status} for page ${page}`);
  const batch = await response.json();
  if (!Array.isArray(batch)) throw new Error(`Unexpected API response on page ${page}`);
  const nextPages = Number(response.headers.get("X-WP-TotalPages"));
  if (Number.isFinite(nextPages) && nextPages > 0) totalPages = nextPages;
  products.push(...batch.map((product) => ({
    sku: product.sku || null,
    title: product.name || null,
    permalink: product.permalink || null,
    weightRaw: product.weight || null,
    dimensionsRaw: product.dimensions || null,
    categories: (product.categories ?? []).map((category) => category.name),
    brands: product.brands ?? null,
  })));
  console.log(`Fetched catalog page ${page}/${totalPages}: ${batch.length} rows; total ${products.length}`);
  await new Promise((resolve) => setTimeout(resolve, 150));
}

const output = {
  source: `${BASE}/wp-json/wc/store/v1/products?search=do88`,
  retrievedAt: new Date().toISOString(),
  pages: totalPages,
  rowCount: products.length,
  productsWithWeightField: products.filter((product) => product.weightRaw !== null).length,
  productsWithAnyDimensionField: products.filter((product) => Object.values(product.dimensionsRaw ?? {}).some(Boolean)).length,
  products,
};
const resolved = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolved), { recursive: true });
await fs.writeFile(resolved, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: resolved, pages: output.pages, rowCount: output.rowCount, productsWithWeightField: output.productsWithWeightField, productsWithAnyDimensionField: output.productsWithAnyDimensionField }, null, 2));
