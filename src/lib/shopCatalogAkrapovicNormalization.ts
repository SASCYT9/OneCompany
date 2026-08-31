import { createHash } from "node:crypto";
import {
  extractChassisForBrandAndModel, extractProductLine,
  extractVehicleBrands, extractVehicleModelNamesForBrand,
} from "./akrapovicFilterUtils";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type AkrapovicSnapshotProduct = {
  id: string; slug: string; sku: string; scope: "auto" | "moto"; brand?: string;
  title: { ua: string; en: string }; tags: string[];
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};
export type AkrapovicApplication = { scope: "auto" | "moto"; make: string; model: string; generation: string | null; yearFrom: number | null; yearTo: number | null };
export type AkrapovicNormalization = {
  productId: string; variantId: string; variantSku: string; recordKey: string; scope: "auto" | "moto";
  mode: "UNIVERSAL" | "VEHICLE_SPECIFIC" | "NEEDS_REVIEW"; applications: AkrapovicApplication[];
  engineRelevant: boolean; verification: "VERIFIED" | "NEEDS_REVIEW"; issues: string[];
};

const makeNames: Record<string, string> = {
  bmw: "BMW", porsche: "Porsche", "mercedes-amg": "Mercedes-AMG", audi: "Audi", cupra: "Cupra",
  lamborghini: "Lamborghini", ferrari: "Ferrari", mclaren: "McLaren", toyota: "Toyota", nissan: "Nissan",
  volkswagen: "Volkswagen", chevrolet: "Chevrolet", renault: "Renault", mini: "Mini", abarth: "Abarth",
  ford: "Ford", "alfa-romeo": "Alfa Romeo", ducati: "Ducati", yamaha: "Yamaha", kawasaki: "Kawasaki",
};
const nonEngineLines = new Set(["rear-wing", "mirror-caps", "diffuser", "protection-bars", "footpegs", "accessories"]);

function titleForEvidence(product: AkrapovicSnapshotProduct) {
  return product.title.en.trim() || product.title.ua.trim();
}

export function normalizeAkrapovicSnapshotProduct(product: AkrapovicSnapshotProduct): AkrapovicNormalization {
  const issues: string[] = [];
  const title = titleForEvidence(product);
  const titleMakes = extractVehicleBrands(title);
  const taggedMakes = [...new Set(product.tags.filter((tag) => tag.startsWith("fits-make:"))
    .map((tag) => makeNames[tag.slice(10)]).filter((value): value is string => Boolean(value)))];
  const makes = titleMakes.length ? titleMakes : taggedMakes;
  if (titleMakes.length && taggedMakes.some((make) => !titleMakes.includes(make))) issues.push("legacy_make_conflict");
  const years = [...new Set(product.tags.filter((tag) => /^fits-year:\d{4}$/.test(tag)).map((tag) => Number(tag.slice(10))))].sort();
  const yearFrom = years[0] ?? null, yearTo = years.at(-1) ?? null;
  if (years.length && years.some((year, index) => index > 0 && year !== years[index - 1]! + 1)) issues.push("year_range_noncontiguous");
  const applications: AkrapovicApplication[] = [];
  for (const make of makes) {
    const models = extractVehicleModelNamesForBrand(title, make);
    for (const model of models) {
      const chassis = extractChassisForBrandAndModel(title, make, model);
      if (chassis.length) for (const generation of chassis) applications.push({ scope: product.scope, make, model, generation, yearFrom, yearTo });
      else applications.push({ scope: product.scope, make, model, generation: null, yearFrom, yearTo });
    }
  }
  const line = extractProductLine(title);
  const engineRelevant = line !== null && !nonEngineLines.has(line);
  if (engineRelevant) issues.push("engine_identity_missing");
  if (/\b(?:OPF|GPF)\b/i.test(title)) issues.push("opf_gpf_constraint_unmodeled");
  const universal = makes.length === 0 && !/\b(?:for|для)\b/i.test(title) && !engineRelevant;
  if (!universal && makes.length === 0) issues.push("vehicle_make_unresolved");
  if (!universal && applications.length === 0) issues.push("vehicle_application_unresolved");
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0], uniqueIssues = [...new Set(issues)].sort();
  const uniqueApplications = [...new Map(applications.map((app) => [`${app.scope}|${app.make}|${app.model}|${app.generation ?? "*"}|${app.yearFrom ?? "*"}|${app.yearTo ?? "*"}`, app])).values()];
  const verification = uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED";
  return { productId: product.id, variantId: variant?.id ?? "", variantSku: variant?.sku?.trim() ?? "", recordKey: `${product.id}:${product.sku}`,
    scope: product.scope, mode: universal ? "UNIVERSAL" : verification === "VERIFIED" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
    applications: uniqueApplications, engineRelevant, verification, issues: uniqueIssues };
}

export function buildAkrapovicSourceRecordDraft(input: { product: AkrapovicSnapshotProduct; sourceRevision: string }) {
  const normalization = normalizeAkrapovicSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants."); const variant = variantField ? input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`Akrapovic variant provenance cannot resolve ${leaf.fieldPath}`);
    const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP";
    return { fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const), canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: legacyScope ? "scope" : variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath, normalizedValue: legacyScope ? normalization.scope : leaf.value,
      mappingStatus: "MAPPED" as const, mapperVersion: "akrapovic-snapshot-v1" as const, confidence: 1 as const,
      reason: legacyScope ? `audited LEGACY SHOP scope maps to ${normalization.scope}` : null, productId: input.product.id, variantId: variant?.id ?? null };
  });
  return { sourceRecord: { recordKey: normalization.recordKey, sourceRevision: input.sourceRevision, rawPayload: input.product,
      payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"), productId: input.product.id }, provenance, normalization,
    issues: normalization.issues.map((issue) => ({ issueKey: `akrapovic:${issue}`, code: issue.toUpperCase(), rawPath: issue.includes("scope") ? "scope" : issue.includes("make") ? "tags" : "title",
      details: { productId: input.product.id, supplierSku: input.product.sku, scope: normalization.scope } })) };
}
