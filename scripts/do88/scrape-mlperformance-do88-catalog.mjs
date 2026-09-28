#!/usr/bin/env node

/** Read-only paginated export of DO88 product/variant shipping-weight fields. */
import fs from "node:fs/promises";
import path from "node:path";

const [, , outputPath] = process.argv;
if (!outputPath) throw new Error("Usage: node scrape-mlperformance-do88-catalog.mjs <output.json>");
const base = "https://www.mlperformance.co.uk";
const limit = 250;
const maxPages = 40;
const products = [];
let pagesFetched = 0;

function plainText(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#215;|&times;/gi, "×")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8217;/gi, "’")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function technicalSpecs(bodyHtml) {
  const specs = [];
  for (const row of String(bodyHtml ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => plainText(cell[1]));
    if (cells.length < 2) continue;
    const label = cells[0].replace(/\s*:\s*$/, "").trim();
    const value = cells.slice(1).filter(Boolean).join(" | ").trim();
    if (/\b(?:total size|core size|overall dimensions|dimensions?|connection size|inner diameter|outer diameter|leg length|length|width|height|weight|diameter)\b/i.test(label) && value) {
      specs.push({ label, value });
    }
  }
  return specs;
}

for (let page = 1; page <= maxPages; page += 1) {
  const url = new URL("/collections/do88/products.json", base);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OneCompany-Do88-Shipping-Audit/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`ML Performance catalogue page ${page}: HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.products)) throw new Error(`Unexpected response on page ${page}`);
  if (payload.products.length === 0) break;
  pagesFetched = page;
  products.push(...payload.products.map((product) => ({
    title: product.title ?? "",
    handle: product.handle ?? "",
    vendor: product.vendor ?? "",
    productType: product.product_type ?? "",
    sourceUrl: new URL(`/products/${product.handle}`, base).toString(),
    technicalSpecs: technicalSpecs(product.body_html),
    variants: (product.variants ?? []).map((variant) => ({
      sku: variant.sku ?? null,
      title: variant.title ?? "",
      option1: variant.option1 ?? null,
      option2: variant.option2 ?? null,
      option3: variant.option3 ?? null,
      grams: Number.isFinite(Number(variant.grams)) && Number(variant.grams) > 0 ? Number(variant.grams) : null,
      requiresShipping: Boolean(variant.requires_shipping),
    })),
  })));
  console.log(`Fetched ML Performance DO88 collection page ${page}: ${payload.products.length} products; total ${products.length}`);
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (payload.products.length < limit) break;
}

const do88Products = products.filter((product) => String(product.vendor).trim().toLowerCase() === "do88");
const variants = do88Products.flatMap((product) => product.variants.map((variant) => ({ ...variant, productTitle: product.title, vendor: product.vendor, sourceUrl: product.sourceUrl })));
const output = {
  source: `${base}/collections/do88/products.json`,
  retrievedAt: new Date().toISOString(),
  pagesFetched,
  productCount: products.length,
  do88VendorProductCount: do88Products.length,
  do88VariantCount: variants.length,
  do88VariantsWithSku: variants.filter((variant) => variant.sku).length,
  do88VariantsWithExplicitPositiveGrams: variants.filter((variant) => variant.grams != null).length,
  products: do88Products,
};
const resolved = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolved), { recursive: true });
await fs.writeFile(resolved, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: resolved, pagesFetched, productCount: output.productCount, do88VendorProductCount: output.do88VendorProductCount, do88VariantsWithSku: output.do88VariantsWithSku, do88VariantsWithExplicitPositiveGrams: output.do88VariantsWithExplicitPositiveGrams }, null, 2));
