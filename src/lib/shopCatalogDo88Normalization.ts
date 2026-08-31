import { createHash } from "node:crypto";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type Do88SnapshotProduct = { id: string; slug: string; sku: string; scope: string; title: { ua: string; en: string }; tags: string[];
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>; [key: string]: unknown };
export type Do88Application = { make: string; model: string; generation: string | null; yearFrom: number | null; yearTo: number | null };
export type Do88Normalization = { productId: string; variantId: string; variantSku: string; recordKey: string; mode: "UNIVERSAL" | "VEHICLE_SPECIFIC" | "NEEDS_REVIEW";
  applications: Do88Application[]; engineRelevant: boolean; verification: "VERIFIED" | "NEEDS_REVIEW"; issues: string[] };

const makeLabels: Record<string, string> = { volvo: "Volvo", saab: "Saab", bmw: "BMW", audi: "Audi", porsche: "Porsche", toyota: "Toyota", ford: "Ford", vw: "Volkswagen",
  cupra: "Cupra", opel: "Opel", mazda: "Mazda", alpine: "Alpine", suzuki: "Suzuki", seat: "SEAT" };
function parseYears(value: string) { const match = value.match(/\b((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?\b/); return { yearFrom: match ? Number(match[1]) : null, yearTo: match?.[2] ? Number(match[2]) : match ? Number(match[1]) : null }; }
function humanFitmentTag(product: Do88SnapshotProduct, make: string) { const prefix = `${makeLabels[make]} `; return product.tags.find((tag) => tag.startsWith(prefix) && !tag.startsWith("fits-")); }
function applicationFromTags(product: Do88SnapshotProduct): Do88Application[] { const rawMake = product.tags.find((tag) => tag.startsWith("fits-make:"))?.slice(10).toLowerCase(); if (!rawMake || !makeLabels[rawMake]) return [];
  const fitment = humanFitmentTag(product, rawMake); if (!fitment) return []; const descriptor = fitment.slice(makeLabels[rawMake].length).trim(); if (!descriptor) return [];
  const years = parseYears(descriptor), generation = descriptor.match(/\b(?:P\d|E\d{2}|F\d{2}|G\d{2}|C\d|B\d|8V|8S|C4|C5|MQB)\b/i)?.[0].toUpperCase() ?? null;
  const model = descriptor.replace(/\([^)]*\)/g, " ").replace(/\b(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\b/g, " ").replace(/\s+/g, " ").replace(/^[\s,/-]+|[\s,/-]+$/g, "").trim();
  return model ? [{ make: makeLabels[rawMake], model, generation, ...years }] : []; }

export function normalizeDo88SnapshotProduct(product: Do88SnapshotProduct): Do88Normalization { const vehicleSpecific = product.tags.includes("Vehicle Specific"), applications = applicationFromTags(product), issues: string[] = [];
  if (vehicleSpecific && !applications.length) issues.push("vehicle_application_unresolved"); const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim()); if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0], verification = issues.length ? "NEEDS_REVIEW" : "VERIFIED"; return { productId: product.id, variantId: variant?.id ?? "", variantSku: variant?.sku?.trim() ?? "", recordKey: `${product.id}:${product.sku}`,
    mode: issues.length ? "NEEDS_REVIEW" : vehicleSpecific ? "VEHICLE_SPECIFIC" : "UNIVERSAL", applications, engineRelevant: vehicleSpecific, verification, issues: [...new Set(issues)].sort() }; }
export function buildDo88SourceRecordDraft(input: { product: Do88SnapshotProduct; sourceRevision: string }) { const normalization = normalizeDo88SnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => { const variantField = leaf.fieldPath.startsWith("variants."), variant = variantField ? input.product.variants.length === 1 ? input.product.variants[0] : input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`do88 variant provenance cannot resolve ${leaf.fieldPath}`); const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP"; return { fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const), canonicalEntityId: variant?.id ?? input.product.id, canonicalField: legacyScope ? "scope" : variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value, mappingStatus: "MAPPED" as const, mapperVersion: "do88-snapshot-v1" as const, confidence: 1 as const, reason: legacyScope ? "audited LEGACY SHOP scope maps to auto" : null, productId: input.product.id, variantId: variant?.id ?? null }; });
  return { sourceRecord: { recordKey: normalization.recordKey, sourceRevision: input.sourceRevision, rawPayload: input.product, payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"), productId: input.product.id }, provenance, normalization,
    issues: normalization.issues.map((issue) => ({ issueKey: `do88:${issue}`, code: issue.toUpperCase(), rawPath: "$", details: { productId: input.product.id, supplierSku: input.product.sku } })) }; }
