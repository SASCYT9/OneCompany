import { createHash } from "node:crypto";
import { extractCsfCatalogFitment, isCleanCsfModelLabel } from "./csfCatalog";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type CsfSnapshotProduct = {
  id: string; slug: string; sku: string; scope: "auto"; title: { ua: string; en: string };
  category?: { ua?: string; en?: string }; stock?: "inStock" | "preOrder"; tags: string[];
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};
export type CsfApplication = { make: string; model: string; generation: string | null; yearFrom: number | null; yearTo: number | null; transmission: string | null };
export type CsfNormalization = { productId: string; variantId: string; variantSku: string; recordKey: string; mode: "VEHICLE_SPECIFIC" | "NEEDS_REVIEW";
  applications: CsfApplication[]; engineRelevant: boolean; transmissionRelevant: boolean; verification: "VERIFIED" | "NEEDS_REVIEW"; issues: string[] };

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function correlatedChassis(title: string, model: string) {
  const match = title.match(new RegExp(`\\b${escapeRegex(model).replace(/\\ /g, "\\s+")}\\b[^()/]{0,25}\\(([^)]+)\\)`, "i"));
  if (!match) return [];
  return [...new Set((match[1]?.match(/\b(?:[A-Z]{1,4}\d{1,4}(?:\.\d)?|\d{3,4})\b/gi) ?? []).map((code) => code.toUpperCase()))];
}
const tagMakeNames: Record<string, string> = { bmw: "BMW", porsche: "Porsche", toyota: "Toyota", nissan: "Nissan", ford: "Ford", subaru: "Subaru",
  chevrolet: "Chevrolet", audi: "Audi", honda: "Honda", "mercedes-benz": "Mercedes-Benz", mitsubishi: "Mitsubishi", mazda: "Mazda", ferrari: "Ferrari",
  jeep: "Jeep", dodge: "Dodge", hyundai: "Hyundai", mclaren: "McLaren", lexus: "Lexus", lamborghini: "Lamborghini", "alfa-romeo": "Alfa Romeo", cadillac: "Cadillac", mini: "Mini", volkswagen: "Volkswagen", lotus: "Lotus" };
function displaySlug(value: string) { return value.split("-").map((part) => /^(?:m\d|rs\d|sti|wrx|gt-r|gt\d|\d{3})$/i.test(part) ? part.toUpperCase() : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" "); }

export function normalizeCsfSnapshotProduct(product: CsfSnapshotProduct): CsfNormalization {
  const issues: string[] = [], fitment = extractCsfCatalogFitment({ title: product.title, slug: product.slug,
    category: { ua: product.category?.ua ?? "", en: product.category?.en ?? "" }, sku: product.sku, stock: product.stock ?? "inStock" });
  const tagMakeSlugs = [...new Set(product.tags.filter((tag) => tag.startsWith("fits-make:")).map((tag) => tag.slice(10)))];
  const tagMake = tagMakeSlugs.length === 1 ? tagMakeNames[tagMakeSlugs[0]!] ?? null : null;
  const make = fitment.make ?? tagMake;
  let models = fitment.make ? fitment.models.filter(isCleanCsfModelLabel) : []; const applications: CsfApplication[] = [];
  const usingLegacyFitment = !models.length && Boolean(make && tagMakeSlugs.length === 1);
  if (usingLegacyFitment) { const prefix = `fits-model:${tagMakeSlugs[0]}:`; models = [...new Set(product.tags.filter((tag) => tag.startsWith(prefix)).map((tag) => displaySlug(tag.slice(prefix.length))))]; if (models.length) issues.push("legacy_fitment_only"); }
  if (!make) issues.push("vehicle_make_unresolved"); if (!models.length) issues.push("vehicle_model_unresolved");
  const title = product.title.en || product.title.ua;
  const details = `${product.title.en} ${String(product.longDescription && typeof product.longDescription === "object" ? (product.longDescription as { en?: string }).en ?? "" : "")}`;
  const manualOnly = /\bManual Transmission Only\b/i.test(details), automaticOnly = /\bAutomatic Transmission Only\b/i.test(details);
  const transmissionRelevant = manualOnly || automaticOnly, transmission = manualOnly !== automaticOnly ? manualOnly ? "MANUAL" : "AUTOMATIC" : null;
  if (manualOnly && automaticOnly) issues.push("transmission_constraint_ambiguous");
  if (make) for (const model of models) { let exact = correlatedChassis(title, model);
    if (usingLegacyFitment) { const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); const trimPrefix = `fits-trim:${tagMakeSlugs[0]}:${modelSlug}:`; exact = product.tags.filter((tag) => tag.startsWith(trimPrefix)).map((tag) => tag.slice(trimPrefix.length).toUpperCase()); }
    if (exact.length) for (const generation of exact) applications.push({ make, model, generation, yearFrom: fitment.yearStart, yearTo: fitment.yearEnd, transmission });
    else if (!usingLegacyFitment && models.length === 1 && fitment.chassisCodes.length) for (const generation of fitment.chassisCodes) applications.push({ make, model, generation, yearFrom: fitment.yearStart, yearTo: fitment.yearEnd, transmission });
    else { applications.push({ make, model, generation: null, yearFrom: fitment.yearStart, yearTo: fitment.yearEnd, transmission }); if (fitment.chassisCodes.length) issues.push("model_chassis_correlation_unresolved"); } }
  const category = `${product.category?.ua ?? ""} ${product.category?.en ?? ""}`;
  const engineRelevant = !/Охолодження трансмісії|Transmission Cooling|З'єднувальні адаптери|Прокладки/i.test(category);
  if (engineRelevant) issues.push("engine_identity_missing");
  if (tagMakeSlugs.length > 1) issues.push("legacy_make_ambiguous");
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim()); if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0], uniqueIssues = [...new Set(issues)].sort(), verification = uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED";
  return { productId: product.id, variantId: variant?.id ?? "", variantSku: variant?.sku?.trim() ?? "", recordKey: `${product.id}:${product.sku}`,
    mode: verification === "VERIFIED" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW", applications: [...new Map(applications.map((app) => [`${app.make}|${app.model}|${app.generation ?? "*"}`, app])).values()],
    engineRelevant, transmissionRelevant, verification, issues: uniqueIssues };
}

export function buildCsfSourceRecordDraft(input: { product: CsfSnapshotProduct; sourceRevision: string }) { const normalization = normalizeCsfSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => { const variantField = leaf.fieldPath.startsWith("variants."); const variant = variantField ? input.product.variants.length === 1 ? input.product.variants[0] : input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`CSF variant provenance cannot resolve ${leaf.fieldPath}`); return { fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const), canonicalEntityId: variant?.id ?? input.product.id, canonicalField: variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath,
      normalizedValue: leaf.value, mappingStatus: "MAPPED" as const, mapperVersion: "csf-snapshot-v1" as const, confidence: 1 as const, reason: null, productId: input.product.id, variantId: variant?.id ?? null }; });
  return { sourceRecord: { recordKey: normalization.recordKey, sourceRevision: input.sourceRevision, rawPayload: input.product, payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"), productId: input.product.id },
    provenance, normalization, issues: normalization.issues.map((issue) => ({ issueKey: `csf:${issue}`, code: issue.toUpperCase(), rawPath: issue.includes("transmission") ? "longDescription.en" : issue.includes("legacy") ? "tags" : "$", details: { productId: input.product.id, supplierSku: input.product.sku } })) };
}
