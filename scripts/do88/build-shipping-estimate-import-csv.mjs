#!/usr/bin/env node

/** Build a minimal catalog-admin CSV that updates only shipping scalars. */
import fs from "node:fs";

const [candidatePath, estimatePath, archivePath, outputPath] = process.argv.slice(2);
if (!candidatePath || !estimatePath || !archivePath || !outputPath) {
  console.error("Usage: node build-shipping-estimate-import-csv.mjs <catalog-candidate.json> <estimates.json> <archive-review.json> <output.csv>");
  process.exit(2);
}
const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const estimate = JSON.parse(fs.readFileSync(estimatePath, "utf8"));
const archiveReview = JSON.parse(fs.readFileSync(archivePath, "utf8"));
const estimatesBySku = new Map(estimate.products.map((product) => [String(product.sku).toUpperCase(), product]));
const pendingArchive = new Set((archiveReview.products ?? []).map((product) => String(product.sku).toUpperCase()));
const headers = [
  "Handle", "Title", "Variant SKU", "Variant Weight", "Variant Weight Unit",
  "Variant Length", "Variant Width", "Variant Height", "Variant Dimensions Estimated", "Variant Weight Estimated",
];
const cell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const rows = [headers];
const missingEstimate = [];
const skuMismatch = [];
const duplicateHandle = new Set();
for (const product of candidate.currentProducts.filter((item) => item.manufacturerDecision === "unverified_do88_candidate")) {
  const skuKey = String(product.sku ?? "").toUpperCase();
  if (pendingArchive.has(skuKey)) continue;
  if (duplicateHandle.has(product.slug)) throw new Error(`Duplicate product handle: ${product.slug}`);
  duplicateHandle.add(product.slug);
  const shipping = estimatesBySku.get(skuKey);
  if (!shipping) { missingEstimate.push(product.sku); continue; }
  const variant = product.currentVariants?.[0];
  if (!variant?.sku) throw new Error(`Product has no existing primary variant SKU: ${product.sku}`);
  if (String(product.sku).toUpperCase() !== String(variant.sku).toUpperCase()) skuMismatch.push({ productSku: product.sku, variantSku: variant.sku });
  if (!product.title?.ua) throw new Error(`Product has no current Ukrainian title required by CSV importer: ${product.sku}`);
  rows.push([
    product.slug,
    product.title.ua,
    variant.sku,
    shipping.weightKg,
    "kg",
    shipping.packageDimensionsCm.length,
    shipping.packageDimensionsCm.width,
    shipping.packageDimensionsCm.height,
    true,
    shipping.weightEstimated,
  ]);
}
if (missingEstimate.length) throw new Error(`Missing shipping estimates for ${missingEstimate.length} SKUs: ${missingEstimate.slice(0, 10).join(", ")}`);
if (skuMismatch.length) throw new Error(`Product/primary variant SKU mismatch in ${skuMismatch.length} rows; refusing import CSV.`);
fs.writeFileSync(outputPath, `${rows.map((row) => row.map(cell).join(",")).join("\n")}\n`, "utf8");
console.log(JSON.stringify({ outputPath, productRows: rows.length - 1, pendingArchiveExcluded: pendingArchive.size, skuMismatch: skuMismatch.length, columns: headers }, null, 2));
