import { createHash } from "node:crypto";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type UrbanSnapshotProduct = {
  id: string; slug: string; sku: string; scope?: string; title: { ua?: string; en?: string };
  tags: string[]; variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};
export type UrbanApplication = { make: string; model: string; generation: string | null };
export type UrbanNormalization = {
  productId: string; variantId: string; variantSku: string; recordKey: string;
  applications: UrbanApplication[]; engineRelevant: boolean;
  verification: "VERIFIED" | "NEEDS_REVIEW"; issues: string[];
};

const brandNames: Record<string, string> = {
  "mercedes-benz": "Mercedes-Benz", "land-rover": "Land Rover", "range-rover": "Range Rover",
  volkswagen: "Volkswagen", lamborghini: "Lamborghini", audi: "Audi",
  "rolls-royce": "Rolls-Royce", bentley: "Bentley",
};
const generationApplications: Record<string, UrbanApplication> = {
  L405: { make: "Range Rover", model: "Range Rover", generation: "L405" },
  L460: { make: "Range Rover", model: "Range Rover", generation: "L460" },
  L494: { make: "Range Rover", model: "Range Rover Sport", generation: "L494" },
  L461: { make: "Range Rover", model: "Range Rover Sport", generation: "L461" },
  L663: { make: "Land Rover", model: "Defender", generation: "L663" },
  W465: { make: "Mercedes-Benz", model: "G-Class", generation: "W465" },
  W463A: { make: "Mercedes-Benz", model: "G-Class", generation: "W463A" },
  "T6.1": { make: "Volkswagen", model: "Transporter", generation: "T6.1" },
};

function detectedModels(make: string, text: string) {
  const patterns: Record<string, Array<[string, RegExp]>> = {
    "Mercedes-Benz": [["G-Class", /\b(?:G-Wagon|G-Class)\b/i], ["EQC", /\bEQC\b/i]],
    "Land Rover": [["Defender", /\bDefender\b/i]],
    "Range Rover": [["Range Rover Sport", /\bRange\s+Rover\s+Sport\b/i], ["Range Rover", /\bRange\s+Rover\b/i]],
    Volkswagen: [["Transporter", /\bT6\.1\b|\bTransporter\b/i], ["Golf R", /\bGolf\s+R\b/i]],
    Lamborghini: [["Urus", /\bUrus\b/i]],
    Audi: [["RSQ8", /\bRSQ8\b/i], ["RS6", /\bRS6\b/i], ["RS7", /\bRS7\b/i], ["RS4", /\bRS4\b/i], ["RS3", /\bRS3\b/i]],
    "Rolls-Royce": [["Cullinan", /\bCullinan\b/i]],
    Bentley: [["Continental GT", /\bContinental\s+GT\b/i]],
  };
  return [...new Set((patterns[make] ?? []).filter(([, pattern]) => pattern.test(text)).map(([model]) => model))];
}

export function normalizeUrbanSnapshotProduct(product: UrbanSnapshotProduct): UrbanNormalization {
  const issues: string[] = [];
  const brandTags = [...new Set(product.tags.filter((tag) => tag.startsWith("urban-vehicle-brand:"))
    .map((tag) => brandNames[tag.slice("urban-vehicle-brand:".length)]).filter((value): value is string => Boolean(value)))];
  const declaredMake = brandTags[0] ?? null;
  if (brandTags.length !== 1) issues.push(brandTags.length ? "vehicle_brand_ambiguous" : "vehicle_brand_missing");
  const text = `${product.title.en ?? ""} ${product.title.ua ?? ""} ${product.tags.join(" ")}`;
  const generations = [...new Set([...text.matchAll(/\b(?:L405|L460|L461|L494|L663|W465|W463A|T6\.1|C8|B9\.5|B9|8Y)\b/gi)]
    .map((match) => match[0]!.toUpperCase()))];
  const applications: UrbanApplication[] = [];
  const directGenerations = generations.filter((generation) => generationApplications[generation]);
  for (const generation of directGenerations) applications.push(generationApplications[generation]!);
  if (declaredMake) {
    const models = detectedModels(declaredMake, text);
    const remainingGenerations = generations.filter((generation) => !generationApplications[generation]);
    for (const model of models) {
      if (applications.some((application) => application.make === declaredMake && application.model === model)) continue;
      const related = remainingGenerations.length ? remainingGenerations : [null];
      for (const generation of related) applications.push({ make: declaredMake, model, generation });
    }
  }
  if (!applications.length) issues.push("vehicle_application_unresolved");
  const engineRelevant = product.tags.includes("urban-family:exhaust");
  if (engineRelevant) issues.push("engine_identity_missing");
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0];
  const uniqueApplications = [...new Map(applications.map((application) => [`${application.make}|${application.model}|${application.generation ?? "*"}`, application])).values()];
  const uniqueIssues = [...new Set(issues)].sort();
  return {
    productId: product.id, variantId: variant?.id ?? "", variantSku: variant?.sku?.trim() ?? "",
    recordKey: `${product.id}:${product.sku}`, applications: uniqueApplications, engineRelevant,
    verification: uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED", issues: uniqueIssues,
  };
}

export function buildUrbanSourceRecordDraft(input: { product: UrbanSnapshotProduct; sourceRevision: string }) {
  const normalization = normalizeUrbanSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants.");
    const variant = variantField ? input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`Urban variant provenance cannot resolve ${leaf.fieldPath}`);
    const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP";
    return { fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const), canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: legacyScope ? "scope" : variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value, mappingStatus: "MAPPED" as const, mapperVersion: "urban-snapshot-v1" as const,
      confidence: 1 as const, reason: legacyScope ? "audited LEGACY SHOP scope maps to auto" : null,
      productId: input.product.id, variantId: variant?.id ?? null };
  });
  return { sourceRecord: { recordKey: normalization.recordKey, sourceRevision: input.sourceRevision, rawPayload: input.product,
      payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"), productId: input.product.id },
    provenance, normalization, issues: normalization.issues.map((issue) => ({ issueKey: `urban:${issue}`, code: issue.toUpperCase(),
      rawPath: issue.startsWith("vehicle_brand") ? "tags" : issue.startsWith("engine") ? "tags" : "$",
      details: { productId: input.product.id, supplierSku: input.product.sku } })) };
}
