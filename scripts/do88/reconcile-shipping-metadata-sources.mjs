#!/usr/bin/env node

/** Reconcile official technical dimensions and exact-SKU retailer weights for Do88 review. */
import fs from "node:fs";

const [candidatePath, officialPath, ukDetailsPath, mlCatalogPath, archiveCsvPath, outputPath] = process.argv.slice(2);
if (!candidatePath || !officialPath || !ukDetailsPath || !mlCatalogPath || !archiveCsvPath || !outputPath) {
  console.error("Usage: node reconcile-shipping-metadata-sources.mjs <candidate.json> <official-specs.json> <uk-details.json> <ml-catalog.json> <archive-review.csv> <output.json>");
  process.exit(2);
}

const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const official = JSON.parse(fs.readFileSync(officialPath, "utf8"));
const uk = JSON.parse(fs.readFileSync(ukDetailsPath, "utf8"));
const mlCatalog = JSON.parse(fs.readFileSync(mlCatalogPath, "utf8"));
const archiveSkus = new Set(fs.readFileSync(archiveCsvPath, "utf8").split(/\r?\n/).slice(1).map((line) => line.split(",")[0]?.replace(/^"|"$/g, "").trim()).filter(Boolean));
const norm = (value) => String(value ?? "").trim().toUpperCase();
const skuKeys = (value) => {
  const raw = norm(value);
  const withoutBrandPrefix = raw.replace(/^DO88-?/, "");
  return [...new Set([raw.replace(/[^A-Z0-9]/g, ""), withoutBrandPrefix.replace(/[^A-Z0-9]/g, "")])].filter(Boolean);
};
const officialBySku = new Map(official.products.map((product) => [norm(product.requestedSku), product]));
const ukBySku = new Map();
for (const page of uk.products) {
  for (const product of page.matchedProducts ?? []) {
    const key = norm(product.currentSku);
    const matches = ukBySku.get(key) ?? [];
    matches.push({
      retailerSku: product.matchedRetailerSku,
      title: product.retailerTitle,
      url: page.url,
      pageCodes: page.pageCodes,
      exactPageCodeMatch: page.exactPageCodeMatch,
      weightKg: page.weight?.weightKg ?? null,
      weightRaw: page.weight?.raw ?? null,
      dimensions: page.dimensions ?? null,
    });
    ukBySku.set(key, matches);
  }
}
const ukAmbiguousBySku = new Map();
for (const item of uk.ambiguous) ukAmbiguousBySku.set(norm(item.sku), item);
const configuratorVariantSkus = new Map();
for (const group of [...(candidate.configuratorUpdates ?? []), ...(candidate.newConfigurableProductCandidates ?? [])]) {
  const currentSku = norm(group.currentProductSku ?? group.currentSku ?? group.sku);
  const skus = configuratorVariantSkus.get(currentSku) ?? [];
  skus.push(...(group.variants ?? []).map((variant) => variant.sku).filter(Boolean));
  configuratorVariantSkus.set(currentSku, skus);
}
const mlSpecsBySku = new Map();
const mlWeightsBySku = new Map();
for (const retailerProduct of mlCatalog.products ?? []) {
  for (const variant of retailerProduct.variants ?? []) {
    if (!variant.sku) continue;
    for (const key of skuKeys(variant.sku)) {
      if ((retailerProduct.technicalSpecs ?? []).length) {
        const specs = mlSpecsBySku.get(key) ?? [];
        specs.push({ retailerSku: variant.sku, productTitle: retailerProduct.title, url: retailerProduct.sourceUrl, specifications: retailerProduct.technicalSpecs });
        mlSpecsBySku.set(key, specs);
      }
      const grams = Number(variant.grams);
      if (Number.isFinite(grams) && grams > 0) {
        const weights = mlWeightsBySku.get(key) ?? [];
        weights.push({ retailerSku: variant.sku, productTitle: retailerProduct.title, url: retailerProduct.sourceUrl, weightGrams: grams, weightKg: Math.round((grams / 1000) * 1000) / 1000, requiresShipping: variant.requiresShipping });
        mlWeightsBySku.set(key, weights);
      }
    }
  }
}
const lookupMlBySkus = (skus) => {
  const matches = new Map();
  for (const sku of skus.filter(Boolean)) for (const key of skuKeys(sku)) for (const row of mlWeightsBySku.get(key) ?? []) matches.set(`${row.url}|${row.retailerSku}`, row);
  return [...matches.values()];
};

const products = candidate.currentProducts.filter((product) => product.manufacturerDecision === "unverified_do88_candidate").map((product) => {
  const key = norm(product.sku);
  const officialPage = officialBySku.get(key) ?? null;
  const ukMatches = ukBySku.get(key) ?? [];
  const ukAmbiguity = ukAmbiguousBySku.get(key) ?? null;
  const productSkuTargets = [product.sku, product.supplierSku].filter(Boolean);
  const mlMatches = lookupMlBySkus(productSkuTargets);
  const configuredSkus = configuratorVariantSkus.get(key) ?? [];
  const variantTargets = [
    ...(product.currentVariants ?? []).map((variant) => ({ sku: variant.sku, variantId: variant.id ?? null, source: "current_catalog_variant" })),
    ...configuredSkus.map((sku) => ({ sku, variantId: null, source: "manufacturer_configurator_candidate" })),
  ].filter((item) => item.sku);
  const variantWeightEvidence = variantTargets.map((target) => ({
    ...target,
    retailerMatches: lookupMlBySkus([target.sku]),
  })).filter((target) => target.retailerMatches.length);
  const possibleSkus = [...productSkuTargets, ...variantTargets.map((target) => target.sku)];
  const technicalMatchMap = new Map();
  for (const possibleSku of possibleSkus) {
    for (const retailerKey of skuKeys(possibleSku)) {
      for (const source of mlSpecsBySku.get(retailerKey) ?? []) {
        technicalMatchMap.set(`${source.url}|${source.retailerSku}`, source);
      }
    }
  }
  const retailerTechnicalSpecs = [...technicalMatchMap.values()];
  const mlValues = [...new Set(mlMatches.filter((match) => match.weightKg != null).map((match) => match.weightKg))];
  const ukValues = [...new Set(ukMatches.filter((match) => match.weightKg != null).map((match) => match.weightKg))];
  const mlRawValues = [...new Set(mlMatches.filter((match) => match.weightKg != null).map((match) => match.weightKg))];
  // A single 1 kg weight is unusually common in the retailer feed and may be
  // its default for missing values; require a second source before promoting it.
  const mlHasCommonDefaultOnly = mlRawValues.length === 1 && mlRawValues[0] === 1;
  let weightKg = null;
  let weightStatus = "no_exact_retailer_weight_found";
  let plausibilityReview = null;
  const weightEvidence = { uk: ukMatches, ml: mlMatches };

  if (archiveSkus.has(product.sku)) {
    weightStatus = "pending_archive_per_owner_request";
  } else if (ukAmbiguity) {
    weightStatus = "ambiguous_uk_retailer_sku_match";
  } else if (ukValues.length > 1) {
    weightStatus = "conflicting_uk_retailer_weights";
  } else if (mlRawValues.length > 1) {
    weightStatus = ukValues.length ? "conflicting_ml_variants_or_duplicate_listings_review" : "conflicting_ml_retailer_weights";
  } else if (ukValues.length === 1 && mlRawValues.length === 1) {
    if (Math.abs(ukValues[0] - mlRawValues[0]) <= Math.max(0.01, ukValues[0] * 0.05)) {
      weightKg = ukValues[0];
      weightStatus = "two_retailers_agree_within_5pct_explicit_kg";
    } else {
      weightStatus = "cross_retailer_weight_conflict";
    }
  } else if (ukValues.length === 1) {
    weightKg = ukValues[0];
    weightStatus = "single_retailer_weight_explicit_kg_review";
  } else if (mlRawValues.length === 1 && mlHasCommonDefaultOnly) {
    weightStatus = "common_1kg_retailer_value_needs_supplier_confirmation";
  } else if (mlRawValues.length === 1) {
    weightKg = mlRawValues[0];
    weightStatus = "single_shopify_retailer_weight_grams_to_kg_review";
  }

  if (weightKg != null && weightKg > 15 && /hose|filter|clamp|silicone|hoodie|apparel|sticker|merch/i.test(product.title?.en ?? "")) {
    plausibilityReview = "weight_over_15kg_for_small_or_soft_good_check_source_listing";
    weightStatus += "_plausibility_review";
  }
  const explicitUkDimensions = ukMatches.map((match) => match.dimensions).filter(Boolean);
  const usablePackageDimensions = explicitUkDimensions.find((item) => item.plausibleScale) ?? null;
  const invalidScaleDimensions = explicitUkDimensions.filter((item) => !item.plausibleScale);

  return {
    sku: product.sku,
    productId: product.productId,
    slug: product.slug,
    titleEn: product.title?.en ?? "",
    manufacturerDecision: product.manufacturerDecision,
    pendingArchive: archiveSkus.has(product.sku),
    officialPage: officialPage ? {
      url: officialPage.sourceUrl,
      exactSkuMatch: officialPage.exactSkuMatch,
      pageSku: officialPage.pageSku,
      totalDimensions: officialPage.productTotalDimensions,
      coreDimensions: officialPage.productCoreDimensions,
      explicitProductWeight: officialPage.productWeight,
      explicitPackageWeight: officialPage.explicitPackageWeight,
      explicitPackageDimensions: officialPage.explicitPackageDimensions,
    } : null,
    retailerWeights: weightEvidence,
    retailerVariantWeightEvidence: variantWeightEvidence,
    retailerTechnicalSpecs,
    hasRetailerProductMeasurements: retailerTechnicalSpecs.some((source) => source.specifications.some((specification) => /size|dimension|length|width|height|diameter|leg/i.test(specification.label))),
    weightKgCandidate: weightKg,
    weightStatus,
    plausibilityReview,
    packageDimensionsCm: usablePackageDimensions ? {
      length: usablePackageDimensions.lengthCm,
      width: usablePackageDimensions.widthCm,
      height: usablePackageDimensions.heightCm,
    } : null,
    packageDimensionsStatus: usablePackageDimensions ? "single_retailer_explicit_unit_review" : invalidScaleDimensions.length ? "retailer_unit_scale_implausible_review" : "no_exact_package_dimensions_found",
    invalidScaleDimensionEvidence: invalidScaleDimensions,
  };
});

const active = products.filter((product) => !product.pendingArchive);
const variantSkuGroups = new Map();
for (const product of active) {
  for (const variant of product.retailerVariantWeightEvidence) {
    const sku = norm(variant.sku);
    const entry = variantSkuGroups.get(sku) ?? { sku, productSkus: new Set(), matches: [] };
    entry.productSkus.add(product.sku);
    entry.matches.push(...variant.retailerMatches);
    variantSkuGroups.set(sku, entry);
  }
}
const variantWeightGroups = [...variantSkuGroups.values()].map((group) => {
  const values = [...new Set(group.matches.map((match) => match.weightKg))];
  return { ...group, values, productSkus: [...group.productSkus] };
});
const weightReady = active.filter((product) => product.weightKgCandidate != null);
const weightConflict = active.filter((product) => /conflict|ambiguous/.test(product.weightStatus));
const weightPlausibilityReview = active.filter((product) => Boolean(product.plausibilityReview));
const weightSafe = active.filter((product) => product.weightKgCandidate != null && !product.plausibilityReview);
const weightDefaultReview = active.filter((product) => product.weightStatus === "common_1kg_retailer_value_needs_supplier_confirmation");
const anyWeightEvidence = active.filter((product) => product.retailerWeights.uk.length || product.retailerWeights.ml.length);
const officialTechnicalDimensionProducts = active.filter((product) => product.officialPage?.totalDimensions?.some((row) => row.parsedMm) || product.officialPage?.coreDimensions?.some((row) => row.parsedMm));
const retailerTechnicalMeasurementProducts = active.filter((product) => product.hasRetailerProductMeasurements);
const packageDimensionProducts = active.filter((product) => product.packageDimensionsCm);
const output = {
  source: "Official English EU specs plus exact-SKU DO88/ML Performance retailer data",
  generatedAt: new Date().toISOString(),
  reviewOnly: true,
  productionWritesPerformed: false,
  scope: { unverifiedDo88Candidates: products.length, pendingArchive: products.filter((product) => product.pendingArchive).length, activeAfterPendingArchive: active.length },
  summary: {
    exactOfficialDetailPagesWithSkuEvidence: active.filter((product) => product.officialPage?.exactSkuMatch).length,
    productsWithOfficialTechnicalDimensions: officialTechnicalDimensionProducts.length,
    productsWithRetailerTechnicalMeasurements: retailerTechnicalMeasurementProducts.length,
    retailerTechnicalMeasurementsAreProductSpecsNotShippingPackageDims: true,
    officialPackageWeightRecords: active.filter((product) => product.officialPage?.explicitPackageWeight?.length).length,
    officialPackageDimensionRecords: active.filter((product) => product.officialPage?.explicitPackageDimensions?.length).length,
    nonConflictingWeightCandidates: weightReady.length,
    weightsWithNoConflictingValueOrPlausibilityFlag: weightSafe.length,
    conflictingOrAmbiguousWeightRecords: weightConflict.length,
    weightValuesFlaggedForPlausibilityReview: weightPlausibilityReview.length,
    common1KgValuesRequiringSupplierConfirmation: weightDefaultReview.length,
    productsWithAnyExactRetailerWeightEvidence: anyWeightEvidence.length,
    productsWithNoExactRetailerWeightEvidence: active.length - anyWeightEvidence.length,
    currentAndProposedVariantsWithRetailerWeightEvidence: active.reduce((sum, product) => sum + product.retailerVariantWeightEvidence.length, 0),
    uniqueVariantSkusWithRetailerWeightEvidence: variantWeightGroups.length,
    variantSkusWithSingleDistinctWeightValue: variantWeightGroups.filter((group) => group.values.length === 1).length,
    variantSkusWithConflictingWeightValues: variantWeightGroups.filter((group) => group.values.length > 1).length,
    variantSkusWithOnlyCommon1KgValue: variantWeightGroups.filter((group) => group.values.length === 1 && group.values[0] === 1).length,
    productsWithExactPackageDimensionsAndExplicitUnits: packageDimensionProducts.length,
  },
  products,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, scope: output.scope, summary: output.summary }, null, 2));
