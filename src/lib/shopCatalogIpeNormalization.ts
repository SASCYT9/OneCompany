import { createHash } from "node:crypto";
import { resolveIpeProductLine, resolveIpeVehicleBrand, resolveIpeVehicleModel } from "./ipeCatalog";
import { splitIpeModelLabel } from "./ipeHeroCatalog";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type IpeSnapshotProduct = {
  id: string; slug: string; sku: string; scope: "auto"; title: { ua: string; en: string };
  collection?: { ua?: string; en?: string }; tags: string[];
  variants: Array<{ id: string; sku: string | null; title?: string; optionValues?: string[]; isDefault: boolean }>;
  [key: string]: unknown;
};
export type IpeApplication = { make: string; model: string; generation: string | null; yearFrom: number | null; yearTo: number | null; opfGpf: string | null };
export type IpeNormalization = {
  productId: string; variantId: string; variantSku: string; recordKey: string; mode: "VEHICLE_SPECIFIC" | "NEEDS_REVIEW";
  applications: IpeApplication[]; engineRelevant: boolean; opfGpfRelevant: boolean;
  verification: "VERIFIED" | "NEEDS_REVIEW"; issues: string[];
};

function catalogProjection(product: IpeSnapshotProduct) {
  return { tags: product.tags, title: product.title,
    collection: { ua: product.collection?.ua ?? "", en: product.collection?.en ?? "" } };
}
function resolveOpf(product: IpeSnapshotProduct, variant: IpeSnapshotProduct["variants"][number] | undefined, issues: string[]) {
  const variantText = `${variant?.title ?? ""} ${(variant?.optionValues ?? []).join(" ")}`;
  if (/\bnon[- ]?opf\b/i.test(variantText)) return "NON_OPF";
  if (/\bopf\b/i.test(variantText)) return "OPF";
  const hasOpf = product.tags.some((tag) => tag.toLowerCase() === "opf");
  const hasNonOpf = product.tags.some((tag) => tag.toLowerCase() === "non-opf");
  if (hasOpf && hasNonOpf) { issues.push("opf_gpf_value_ambiguous"); return null; }
  return hasNonOpf ? "NON_OPF" : hasOpf ? "OPF" : null;
}

export function normalizeIpeSnapshotProduct(product: IpeSnapshotProduct): IpeNormalization {
  const issues: string[] = [], projection = catalogProjection(product);
  const make = resolveIpeVehicleBrand(projection), modelLabel = resolveIpeVehicleModel(projection);
  if (!make) issues.push("vehicle_make_unresolved"); if (!modelLabel) issues.push("vehicle_model_unresolved");
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous"); const variant = variants[0];
  const opfGpf = resolveOpf(product, variant, issues);
  const opfGpfRelevant = opfGpf !== null || product.tags.some((tag) => /^(?:non-)?opf$/i.test(tag)) || product.variants.some((item) => /\b(?:non[- ]?)?opf\b/i.test(`${item.title ?? ""} ${(item.optionValues ?? []).join(" ")}`));
  if (opfGpfRelevant && !opfGpf && !issues.includes("opf_gpf_value_ambiguous")) issues.push("opf_gpf_value_missing");
  const line = resolveIpeProductLine(projection), engineRelevant = line === "Downpipe / Cats" || line === "Headers" || line === "Valvetronic Exhaust";
  if (engineRelevant) issues.push("engine_identity_missing");
  const years = [...new Set(product.tags.filter((tag) => /^(?:19|20)\d{2}$/.test(tag)).map(Number))].sort();
  if (years.some((year, index) => index > 0 && year !== years[index - 1]! + 1)) issues.push("year_range_noncontiguous");
  const applications: IpeApplication[] = [];
  if (make && modelLabel) { const { base, body } = splitIpeModelLabel(modelLabel); const generations = body ? body.split(/[\/;,]/).map((value) => value.trim()).filter(Boolean) : [null];
    for (const generation of generations) applications.push({ make, model: base, generation, yearFrom: years[0] ?? null, yearTo: years.at(-1) ?? null, opfGpf }); }
  const uniqueIssues = [...new Set(issues)].sort(), verification = uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED";
  return { productId: product.id, variantId: variant?.id ?? "", variantSku: variant?.sku?.trim() ?? "", recordKey: `${product.id}:${product.sku}`,
    mode: verification === "VERIFIED" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW", applications, engineRelevant, opfGpfRelevant, verification, issues: uniqueIssues };
}

export function buildIpeSourceRecordDraft(input: { product: IpeSnapshotProduct; sourceRevision: string }) {
  const normalization = normalizeIpeSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => { const variantField = leaf.fieldPath.startsWith("variants."); const variant = variantField ? input.product.variants.length === 1 ? input.product.variants[0] : input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`iPE variant provenance cannot resolve ${leaf.fieldPath}`); return { fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const), canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath, normalizedValue: leaf.value, mappingStatus: "MAPPED" as const,
      mapperVersion: "ipe-snapshot-v1" as const, confidence: 1 as const, reason: null, productId: input.product.id, variantId: variant?.id ?? null }; });
  return { sourceRecord: { recordKey: normalization.recordKey, sourceRevision: input.sourceRevision, rawPayload: input.product,
      payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"), productId: input.product.id }, provenance, normalization,
    issues: normalization.issues.map((issue) => ({ issueKey: `ipe:${issue}`, code: issue.toUpperCase(), rawPath: issue.startsWith("opf") ? "variants" : issue.startsWith("year") ? "tags" : "$",
      details: { productId: input.product.id, supplierSku: input.product.sku } })) };
}
