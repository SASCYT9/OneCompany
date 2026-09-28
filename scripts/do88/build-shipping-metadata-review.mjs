#!/usr/bin/env node

/** Build a full-scope, source-backed, review-only CSV for shipping metadata. */
import fs from "node:fs";

const [researchPath, outputCsvPath] = process.argv.slice(2);
if (!researchPath || !outputCsvPath) {
  console.error("Usage: node build-shipping-metadata-review.mjs <shipping-review.json> <output.csv>");
  process.exit(2);
}
const research = JSON.parse(fs.readFileSync(researchPath, "utf8"));
const headers = [
  "sku","product_id","slug","title_en","manufacturer_decision","pending_archive",
  "exact_official_sku_page","official_page_sku","official_page_url",
  "official_product_total_dimensions_raw","official_product_total_dimensions_mm","official_core_dimensions_raw","official_core_dimensions_mm","retailer_technical_product_measurements",
  "weight_kg_candidate","weight_status","weight_source_details","retailer_variant_weight_details",
  "package_length_cm","package_width_cm","package_height_cm","package_dimensions_status","dimension_source_details"
];
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const rows = [headers];
for (const product of research.products) {
  const official = product.officialPage;
  const totalRows = official?.totalDimensions ?? [];
  const coreRows = official?.coreDimensions ?? [];
  const fmtRaw = (items) => items.map((row) => `${row.label}: ${row.value}`).join("; ");
  const fmtMm = (items) => items.map((row) => row.parsedMm ? `${row.parsedMm.lengthMm}×${row.parsedMm.widthMm}×${row.parsedMm.heightMm} mm` : "").filter(Boolean).join("; ");
  const uk = product.retailerWeights?.uk ?? [];
  const ml = product.retailerWeights?.ml ?? [];
  const invalidDims = product.invalidScaleDimensionEvidence ?? [];
  const packageDims = product.packageDimensionsCm;
  const dimensionSources = [
    ...uk.map((item) => ({ source: "do88.co.uk", sku: item.retailerSku, url: item.url, dims: item.dimensions })),
    ...invalidDims.map((item) => ({ source: "do88.co.uk", rawDimensions: item.raw, unit: item.unit, flag: "unit scale implausible; excluded from package dimensions" })),
  ];
  const weightSources = [
    ...uk.map((item) => ({ source: "do88.co.uk", sku: item.retailerSku, url: item.url, weightKg: item.weightKg, evidence: item.weightRaw })),
    ...ml.map((item) => ({ source: "ML Performance", sku: item.retailerSku, url: item.url, weightKg: item.weightKg, weightGrams: item.weightGrams, title: item.title })),
  ];
  const variantWeightSources = (product.retailerVariantWeightEvidence ?? []).flatMap((variant) =>
    variant.retailerMatches.map((item) => ({
      targetVariantSku: variant.sku,
      targetVariantSource: variant.source,
      source: "ML Performance",
      retailerSku: item.retailerSku,
      weightKg: item.weightKg,
      weightGrams: item.weightGrams,
      productTitle: item.productTitle,
      url: item.url,
    }))
  );
  rows.push([
    product.sku,product.productId,product.slug,product.titleEn,product.manufacturerDecision,product.pendingArchive,
    official?.exactSkuMatch === true,official?.pageSku ?? "",official?.url ?? "",
    fmtRaw(totalRows),fmtMm(totalRows),fmtRaw(coreRows),fmtMm(coreRows),JSON.stringify(product.retailerTechnicalSpecs ?? []),
    product.weightKgCandidate ?? "",product.weightStatus,JSON.stringify(weightSources),JSON.stringify(variantWeightSources),
    packageDims?.length ?? "",packageDims?.width ?? "",packageDims?.height ?? "",product.packageDimensionsStatus,JSON.stringify(dimensionSources)
  ]);
}
fs.writeFileSync(outputCsvPath, `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
console.log(JSON.stringify({
  reviewOnly: research.reviewOnly,
  productRows: rows.length - 1,
  summary: research.summary,
  outputCsvPath,
}, null, 2));
