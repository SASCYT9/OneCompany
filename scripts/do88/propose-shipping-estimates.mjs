#!/usr/bin/env node

/** Build a review-only logistics candidate; never writes catalog or Production. */
import fs from "node:fs";

const [candidatePath, reconciliationPath, outputJsonPath, outputCsvPath] = process.argv.slice(2);
if (!candidatePath || !reconciliationPath || !outputJsonPath || !outputCsvPath) {
  console.error("Usage: node propose-shipping-estimates.mjs <candidate.json> <shipping-reconciliation.json> <output.json> <output.csv>");
  process.exit(2);
}

const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const reconciliation = JSON.parse(fs.readFileSync(reconciliationPath, "utf8"));
const bySku = new Map(reconciliation.products.map((product) => [String(product.sku).toUpperCase(), product]));

const PROFILES = {
  intercooler: { length: 75, width: 45, height: 22, weightKg: 8, paddingCm: 4 },
  intercooler_kit: { length: 85, width: 60, height: 38, weightKg: 18, paddingCm: 5 },
  radiator: { length: 85, width: 60, height: 28, weightKg: 10, paddingCm: 5 },
  oil_cooler: { length: 55, width: 38, height: 22, weightKg: 3.5, paddingCm: 4 },
  intake_system: { length: 78, width: 48, height: 38, weightKg: 5, paddingCm: 5 },
  multi_product_bundle: { length: 58, width: 42, height: 30, weightKg: 5, paddingCm: 4 },
  vehicle_hose_kit: { length: 48, width: 36, height: 24, weightKg: 2.5, paddingCm: 4 },
  single_hose_or_coupler: { length: 25, width: 20, height: 12, weightKg: 0.45, paddingCm: 3 },
  long_hose_or_pipe: { length: 110, width: 18, height: 18, weightKg: 1.8, paddingCm: 5 },
  charge_pipe_or_turbo_pipe: { length: 75, width: 35, height: 25, weightKg: 2.5, paddingCm: 4 },
  engine_cover: { length: 110, width: 62, height: 22, weightKg: 12, paddingCm: 5 },
  exhaust_component: { length: 90, width: 35, height: 30, weightKg: 4.5, paddingCm: 5 },
  clamp_or_small_hardware_kit: { length: 25, width: 20, height: 12, weightKg: 0.8, paddingCm: 3 },
  merchandise: { length: 35, width: 28, height: 10, weightKg: 0.8, paddingCm: 3 },
  vehicle_accessory: { length: 38, width: 28, height: 18, weightKg: 1.5, paddingCm: 4 },
};

function classify(product) {
  const sku = String(product.sku ?? "").toUpperCase();
  const title = String(product.title?.en ?? "");
  const text = `${sku} ${title}`.toLowerCase();
  if (/clamp[- ]?kit|hose clamp|clamp set/.test(text)) return "clamp_or_small_hardware_kit";
  if (/oil cooler|oilcooler/.test(text)) return "oil_cooler";
  if (/intercooler kit|intercooler system|intercooler with/.test(text) || /^icm-/i.test(sku)) return "intercooler_kit";
  if (/radiator|heat exchanger/.test(text) || /^(wc-|rad-)/i.test(sku)) return "radiator";
  if (/intercooler|charge[- ]air cooler/.test(text) || /^(icm?-)/i.test(sku)) return "intercooler";
  if (/intake system|intake kit|induction system/.test(text) || /^lf-/i.test(sku)) return "intake_system";
  if (/big ?pack|complete pack|performance pack/.test(text) || /^big-/i.test(sku)) return "multi_product_bundle";
  if (/engine cover|carbon cover/.test(text) || /^mk-/i.test(sku)) return "engine_cover";
  if (/hoodie|t-?shirt|beanie|cap|merchandise|key ?chain/.test(text)) return "merchandise";
  if (/exhaust|muffler|tail ?pipe|silencer/.test(text)) return "exhaust_component";
  if (/^sbr|^sb\d|^sf\d|^scob|silicone hose|silicone coupler|elbow hose|straight hose/.test(text)) {
    const maxLengthMm = exactSpecLengthsMm(product).reduce((max, value) => Math.max(max, value), 0);
    return maxLengthMm >= 500 ? "long_hose_or_pipe" : "single_hose_or_coupler";
  }
  if (/hose kit|hose set|hoses|inlet hose|coolant hose|heater hose|boost hose|^do88-kit/i.test(text)) return "vehicle_hose_kit";
  if (/pipe|tube|duct|turbo inlet|resonator delete/.test(text) || /^(tr-|cp-|ir-|a3|a4)/i.test(sku)) return "charge_pipe_or_turbo_pipe";
  return "vehicle_accessory";
}

function exactSpecLengthsMm(product) {
  const values = [];
  for (const source of product.retailerTechnicalSpecs ?? []) {
    for (const specification of source.specifications ?? []) {
      if (!/^length$/i.test(String(specification.label ?? "").trim())) continue;
      const match = String(specification.value ?? "").match(/([\d.,]+)\s*(mm|cm|m)\b/i);
      if (!match) continue;
      const raw = Number(match[1].replace(",", "."));
      const factor = match[2].toLowerCase() === "m" ? 1000 : match[2].toLowerCase() === "cm" ? 10 : 1;
      if (Number.isFinite(raw) && raw > 0) values.push(raw * factor);
    }
  }
  return values;
}

function roundUp5(value) { return Math.ceil(value / 5) * 5; }
function packageFromOfficialDimensions(product, category, profile) {
  if (!["intercooler", "intercooler_kit", "radiator", "oil_cooler"].includes(category)) return null;
  const rows = product.officialPage?.totalDimensions ?? [];
  const row = rows.find((item) => item.parsedMm && /total|overall/i.test(item.label));
  if (!row?.parsedMm) return null;
  const pad = profile.paddingCm;
  const dimensions = [row.parsedMm.lengthMm, row.parsedMm.widthMm, row.parsedMm.heightMm]
    .map((mm) => roundUp5(mm / 10 + pad * 2))
    .sort((a, b) => b - a);
  return { lengthCm: dimensions[0], widthCm: dimensions[1], heightCm: dimensions[2], basis: "official_total_product_dimensions_plus_packaging_clearance" };
}
function packageFromLongItem(product, category) {
  if (!["long_hose_or_pipe", "charge_pipe_or_turbo_pipe"].includes(category)) return null;
  const lengths = exactSpecLengthsMm(product);
  const lengthMm = lengths.length ? Math.max(...lengths) : 0;
  if (!lengthMm) return null;
  // Flexible hoses can be coiled; rigid pipes retain the measured length.
  if (category === "long_hose_or_pipe" && /hose/i.test(product.titleEn)) {
    const coil = Math.min(45, roundUp5(Math.max(25, Math.sqrt(lengthMm / Math.PI) * 2 + 10)));
    return { lengthCm: coil, widthCm: coil, heightCm: 18, basis: "measured_flexible_hose_length_coiled_estimate" };
  }
  const profile = PROFILES[category];
  const lengthCm = roundUp5(lengthMm / 10 + profile.paddingCm * 2);
  return { lengthCm, widthCm: profile.width, heightCm: profile.height, basis: "retailer_product_length_plus_packaging_clearance" };
}
function makeShippingCandidate({ sku, titleEn, source, technicalSpecs }) {
  const category = classify({ sku, title: { en: titleEn }, retailerTechnicalSpecs: technicalSpecs ?? source.retailerTechnicalSpecs });
  const profile = PROFILES[category];
  const sourceProduct = { ...source, titleEn, retailerTechnicalSpecs: technicalSpecs ?? source.retailerTechnicalSpecs };
  const fromOfficial = packageFromOfficialDimensions(source, category, profile);
  const fromRetailerSize = packageFromLongItem(sourceProduct, category);
  const packageEstimate = fromOfficial ?? fromRetailerSize ?? {
    lengthCm: profile.length, widthCm: profile.width, heightCm: profile.height,
    basis: "estimated_category_package_profile",
  };
  const sourceWeightMatches = source.retailerVariantWeightEvidence
    ?.filter((variant) => String(variant.sku).toUpperCase() === String(sku).toUpperCase())
    .flatMap((variant) => variant.retailerMatches) ?? [];
  const sourceWeightValues = [...new Set(sourceWeightMatches.map((match) => match.weightKg))];
  const useSourceWeight = sourceWeightValues.length === 1 && sourceWeightValues[0] !== 1;
  return {
    sku,
    titleEn,
    estimatedCategory: category,
    weightKg: useSourceWeight ? sourceWeightValues[0] : profile.weightKg,
    weightStatus: useSourceWeight ? "single_distinct_exact_variant_retailer_value_packaging_inclusion_unverified" : "estimated_category_product_weight",
    weightEstimated: !useSourceWeight,
    weightEvidence: useSourceWeight ? sourceWeightMatches : null,
    packageDimensionsCm: { length: packageEstimate.lengthCm, width: packageEstimate.widthCm, height: packageEstimate.heightCm },
    packageDimensionsEstimated: true,
    isDimensionsEstimated: true,
    dimensionsBasis: packageEstimate.basis,
    profile,
  };
}

const archived = new Set(reconciliation.products.filter((product) => product.pendingArchive).map((product) => product.sku));
const currentProductRows = reconciliation.products.filter((product) => !product.pendingArchive);
const products = currentProductRows.map((product) => {
  const source = bySku.get(String(product.sku).toUpperCase());
  const sourceWeight = product.weightKgCandidate;
  const useSourceWeight = sourceWeight != null;
  const base = makeShippingCandidate({ sku: product.sku, titleEn: product.titleEn, source, technicalSpecs: product.retailerTechnicalSpecs });
  const proposedConfigurator = (candidate.configuratorUpdates ?? []).find((group) => String(group.currentProductSku).toUpperCase() === String(product.sku).toUpperCase());
  const newConfigurableProduct = (candidate.newConfigurableProductCandidates ?? []).find((group) => String(group.sku).toUpperCase() === String(product.sku).toUpperCase());
  const proposedVariants = [...(proposedConfigurator?.variants ?? []), ...(newConfigurableProduct?.variants ?? [])];
  const variantShippingEstimates = proposedVariants.map((variant) => makeShippingCandidate({
    sku: variant.sku,
    titleEn: variant.title ?? product.titleEn,
    source,
    technicalSpecs: product.retailerTechnicalSpecs,
  }));
  return {
    sku: product.sku,
    productId: product.productId,
    slug: product.slug,
    titleEn: product.titleEn,
    estimatedCategory: base.estimatedCategory,
    weightKg: useSourceWeight ? sourceWeight : base.profile.weightKg,
    weightStatus: useSourceWeight ? "retailer_reported_exact_sku_reviewed_candidate_packaging_inclusion_unverified" : "estimated_category_product_weight",
    weightEstimated: !useSourceWeight,
    weightEvidence: useSourceWeight ? product.retailerWeights : null,
    packageDimensionsCm: base.packageDimensionsCm,
    packageDimensionsEstimated: true,
    isDimensionsEstimated: true,
    dimensionsBasis: base.dimensionsBasis,
    profile: base.profile,
    variantShippingEstimates,
    officialProductDimensionsMm: product.officialPage?.totalDimensions ?? [],
    retailerTechnicalSpecs: product.retailerTechnicalSpecs,
  };
});

const countsByCategory = Object.fromEntries(Object.keys(PROFILES).map((category) => [category, products.filter((product) => product.estimatedCategory === category).length]));
const output = {
  generatedAt: new Date().toISOString(),
  reviewOnly: true,
  productionWritesPerformed: false,
  estimateApprovedByUser: true,
  scope: { activeProducts: products.length, excludedPendingArchive: archived.size },
  methodology: {
    units: "kg and cm",
    allPackageDimensionsEstimated: true,
    exactSkuRetailerWeightUsedWhenReconciliationProducedOneNonconflictingCandidate: true,
    allOtherWeightsUseCategoryProductWeightEstimate: true,
    retailerWeightPackagingInclusionVerified: false,
    packageDimensionsFromProductSpecificationsUseClearanceAndRemainMarkedEstimated: true,
    valuesAreShippingEstimatesAndRequireReviewBeforeProduction: true,
  },
  summary: {
    productsWithPackageEstimate: products.length,
    productsWithRetailerReportedWeightCandidate: products.filter((product) => !product.weightEstimated).length,
    productsWithEstimatedWeight: products.filter((product) => product.weightEstimated).length,
    proposedConfiguratorVariantsWithShippingEstimate: products.reduce((sum, product) => sum + product.variantShippingEstimates.length, 0),
    proposedConfiguratorVariantsWithRetailerReportedWeight: products.reduce((sum, product) => sum + product.variantShippingEstimates.filter((variant) => !variant.weightEstimated).length, 0),
    productsWithOfficialTotalDimensionsUsedAsEstimate: products.filter((product) => product.dimensionsBasis === "official_total_product_dimensions_plus_packaging_clearance").length,
    productsWithRetailerLengthUsedAsEstimate: products.filter((product) => product.dimensionsBasis === "retailer_product_length_plus_packaging_clearance" || product.dimensionsBasis === "measured_flexible_hose_length_coiled_estimate").length,
    productsUsingCategoryPackageProfile: products.filter((product) => product.dimensionsBasis === "estimated_category_package_profile").length,
    estimatedCategories: countsByCategory,
  },
  products,
};
fs.writeFileSync(outputJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

const headers = ["sku","product_id","slug","title_en","estimated_category","weight_kg","weight_estimated","weight_status","package_length_cm","package_width_cm","package_height_cm","dimensions_estimated","dimensions_basis","variant_shipping_estimates"];
const cell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const rows = [headers, ...products.map((product) => [product.sku,product.productId,product.slug,product.titleEn,product.estimatedCategory,product.weightKg,product.weightEstimated,product.weightStatus,product.packageDimensionsCm.length,product.packageDimensionsCm.width,product.packageDimensionsCm.height,true,product.dimensionsBasis,JSON.stringify(product.variantShippingEstimates)])];
fs.writeFileSync(outputCsvPath, `${rows.map((row) => row.map(cell).join(",")).join("\n")}\n`, "utf8");
console.log(JSON.stringify({ outputJsonPath, outputCsvPath, scope: output.scope, summary: output.summary }, null, 2));
