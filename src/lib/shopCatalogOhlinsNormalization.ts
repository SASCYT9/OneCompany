import { createHash } from "node:crypto";
import { buildOhlinsHeroVehicleTree, detectOhlinsMake } from "./ohlinsCatalog";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type OhlinsSnapshotProduct = {
  id: string; slug: string; sku: string; scope?: string;
  title: { ua: string; en: string }; shortDescription?: { ua?: string; en?: string };
  tags: string[]; variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};
export type OhlinsApplication = { make: string; model: string; generation: string | null };
export type OhlinsNormalization = {
  productId: string; variantId: string; variantSku: string; recordKey: string;
  mode: "UNIVERSAL" | "VEHICLE_SPECIFIC" | "NEEDS_REVIEW";
  applications: OhlinsApplication[]; engineRelevant: false;
  verification: "VERIFIED" | "NEEDS_REVIEW"; issues: string[];
};

export function normalizeOhlinsSnapshotProduct(product: OhlinsSnapshotProduct): OhlinsNormalization {
  const issues: string[] = [];
  const catalogProduct = { slug: product.slug, title: product.title,
    shortDescription: { ua: product.shortDescription?.ua ?? "", en: product.shortDescription?.en ?? "" } };
  const make = detectOhlinsMake(catalogProduct);
  const tagMakes = [...new Set(product.tags.filter((tag) => tag.startsWith("fits-make:")).map((tag) => tag.slice(10)))];
  const universal = make === "Universal" || tagMakes.includes("universal");
  const tree = universal ? [] : buildOhlinsHeroVehicleTree([catalogProduct]);
  const applications: OhlinsApplication[] = [];
  for (const makeNode of tree) for (const model of makeNode.models) {
    if (model.chassis.length) for (const generation of model.chassis) applications.push({ make: makeNode.make, model: model.name, generation });
    else applications.push({ make: makeNode.make, model: model.name, generation: null });
  }
  if (!universal && (!make || make === "Volkswagen/Audi")) issues.push("vehicle_make_unresolved");
  if (!universal && !applications.length) issues.push("vehicle_application_unresolved");
  const text = `${product.title.en ?? ""} ${product.shortDescription?.en ?? ""}`;
  if (/\b(?:RWD\s+Only|AWD\s+Only|FWD\s+Only|xDrive|sDrive|4WD\s+Only)\b/i.test(text)) issues.push("drivetrain_constraint_unmodeled");
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0];
  const uniqueApplications = [...new Map(applications.map((app) => [`${app.make}|${app.model}|${app.generation ?? "*"}`, app])).values()];
  const uniqueIssues = [...new Set(issues)].sort();
  const verification = uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED";
  return { productId: product.id, variantId: variant?.id ?? "", variantSku: variant?.sku?.trim() ?? "",
    recordKey: `${product.id}:${product.sku}`, mode: universal ? "UNIVERSAL" : verification === "VERIFIED" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
    applications: uniqueApplications, engineRelevant: false, verification, issues: uniqueIssues };
}

export function buildOhlinsSourceRecordDraft(input: { product: OhlinsSnapshotProduct; sourceRevision: string }) {
  const normalization = normalizeOhlinsSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants.");
    const variant = variantField ? input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`Ohlins variant provenance cannot resolve ${leaf.fieldPath}`);
    const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP";
    return { fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const), canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: legacyScope ? "scope" : variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value, mappingStatus: "MAPPED" as const, mapperVersion: "ohlins-snapshot-v1" as const,
      confidence: 1 as const, reason: legacyScope ? "audited LEGACY SHOP scope maps to auto" : null,
      productId: input.product.id, variantId: variant?.id ?? null };
  });
  return { sourceRecord: { recordKey: normalization.recordKey, sourceRevision: input.sourceRevision, rawPayload: input.product,
      payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"), productId: input.product.id },
    provenance, normalization, issues: normalization.issues.map((issue) => ({ issueKey: `ohlins:${issue}`, code: issue.toUpperCase(),
      rawPath: issue.includes("drivetrain") ? "title.en" : issue.includes("make") ? "tags" : "$",
      details: { productId: input.product.id, supplierSku: input.product.sku } })) };
}
