import { createHash } from "node:crypto";

import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type AdroSnapshotProduct = {
  id: string;
  slug: string;
  sku: string;
  scope?: string;
  title: { ua?: string; en?: string };
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};

export type AdroApplication = {
  make: string;
  model: string;
  generation: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};

export type AdroNormalization = {
  productId: string;
  variantId: string;
  variantSku: string;
  recordKey: string;
  applications: AdroApplication[];
  verification: "VERIFIED" | "NEEDS_REVIEW";
  issues: string[];
};

type VehiclePattern = { make: string; model: string; pattern: RegExp };

// Ordered longest/specific first. These are supplier-label mappings, not runtime
// filter branches; persisted aliases resolve to the shared vehicle taxonomy.
const vehiclePatterns: VehiclePattern[] = [
  { make: "Honda", model: "Civic Type R", pattern: /\bCivic\s+Type\s+R\b/gi },
  { make: "Hyundai", model: "Ioniq 5 N", pattern: /\bIoniq\s+5\s+N\b/gi },
  { make: "Hyundai", model: "Veloster N", pattern: /\bVeloster\s+N\b/gi },
  { make: "Hyundai", model: "Elantra N", pattern: /\bElantra\s+N\b/gi },
  { make: "Toyota", model: "GR Supra", pattern: /\b(?:GR\s+Supra|Supra\s+GR)\b/gi },
  { make: "Toyota", model: "GR Yaris", pattern: /\bGR\s+Yaris\b/gi },
  { make: "Toyota", model: "GR86", pattern: /\bGR86\b/gi },
  { make: "Subaru", model: "BRZ", pattern: /\bBRZ\b/gi },
  { make: "Porsche", model: "911 GT3", pattern: /\b911\s+GT3\b/gi },
  { make: "Porsche", model: "718 Cayman", pattern: /\b718\s+Cayman\b/gi },
  { make: "Porsche", model: "718 Boxster", pattern: /\b718\s+Boxster\b/gi },
  { make: "Porsche", model: "718 Cayman", pattern: /\bCayman\b/gi },
  { make: "Porsche", model: "718 Boxster", pattern: /\bBoxster\b/gi },
  { make: "Porsche", model: "718 Spyder", pattern: /\b(?:718\s+)?Spyder\b/gi },
  { make: "Porsche", model: "718", pattern: /\b718\b/gi },
  { make: "Genesis", model: "GV80", pattern: /\bGV80\b/gi },
  { make: "Genesis", model: "GV70", pattern: /\bGV70\b/gi },
  { make: "Genesis", model: "G80", pattern: /\bG80\b/gi },
  { make: "Genesis", model: "G70", pattern: /\bG70\b/gi },
  { make: "Chevrolet", model: "Corvette", pattern: /\bCorvette\b/gi },
  { make: "Ford", model: "Mustang", pattern: /\bMustang\b/gi },
  { make: "Kia", model: "Stinger", pattern: /\bStinger\b/gi },
  { make: "Kia", model: "K5", pattern: /\bK5\b/gi },
  { make: "Tesla", model: "Model Y", pattern: /\bModel\s+Y\b/gi },
  { make: "Tesla", model: "Model 3", pattern: /\bModel\s+3\b/gi },
  { make: "BMW", model: "X3 M40i", pattern: /\bX3\s*M40i\b/gi },
  { make: "BMW", model: "X5 M", pattern: /\bX5\s*M\b/gi },
  { make: "BMW", model: "X3 M", pattern: /\bX3\s*M\b/gi },
  { make: "BMW", model: "M340i", pattern: /\bM340i\b/gi },
  { make: "BMW", model: "M340d", pattern: /\bM340d\b/gi },
  { make: "BMW", model: "M240i", pattern: /\bM240i\b/gi },
  { make: "BMW", model: "M440i", pattern: /\bM440i\b/gi },
  { make: "BMW", model: "M2", pattern: /\bM2\b/gi },
  { make: "BMW", model: "M3", pattern: /\bM3\b/gi },
  { make: "BMW", model: "M4", pattern: /\bM4\b/gi },
  { make: "BMW", model: "M5", pattern: /\bM5\b/gi },
  { make: "BMW", model: "2 Series", pattern: /\b2\s+Series\b/gi },
  { make: "BMW", model: "3 Series", pattern: /\b3\s+Series\b/gi },
  { make: "BMW", model: "4 Series", pattern: /\b4\s+Series\b/gi },
];

function fitmentText(product: AdroSnapshotProduct) {
  const title = product.title.en || product.title.ua || "";
  const match = /(?:\bfor\b|для)\s+(.+)$/i.exec(title);
  return match?.[1]?.trim() ?? "";
}

function parseYears(value: string) {
  const range = /\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/.exec(value);
  if (range) return { yearFrom: Number(range[1]), yearTo: Number(range[2]) };
  const open = /\b((?:19|20)\d{2})\s*(?:\+|-)(?:\.|\s|$)/.exec(value);
  return open ? { yearFrom: Number(open[1]), yearTo: null } : { yearFrom: null, yearTo: null };
}

function chassisValues(value: string) {
  const values = new Set<string>();
  for (const group of value.matchAll(/\(([^)]+)\)/g)) {
    for (const token of group[1]!.split(/[\s/,]+/)) {
      const normalized = token.trim().toUpperCase();
      if (/^(?:[A-Z]{1,3}\d{1,3}(?:\.\d)?|\d{3}(?:\.\d)?)$/.test(normalized)) values.add(normalized);
    }
  }
  return [...values];
}

function insideParentheses(value: string, index: number) {
  let depth = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (value[cursor] === "(") depth += 1;
    else if (value[cursor] === ")") depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

export function normalizeAdroSnapshotProduct(product: AdroSnapshotProduct): AdroNormalization {
  const issues: string[] = [];
  const text = fitmentText(product);
  if (!text) issues.push("fitment_text_missing");
  const years = parseYears(text);
  const matches: Array<{ make: string; model: string; index: number; end: number }> = [];
  for (const entry of vehiclePatterns) {
    for (const match of text.matchAll(entry.pattern)) {
      if (insideParentheses(text, match.index ?? 0)) continue;
      matches.push({
        make: entry.make,
        model: entry.model,
        index: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      });
    }
  }
  matches.sort((left, right) => left.index - right.index || right.end - left.end);
  const nonOverlapping = matches.filter(
    (candidate, index, all) => !all.some((other, otherIndex) => otherIndex < index && candidate.index < other.end)
  );
  const applications: AdroApplication[] = [];
  for (let index = 0; index < nonOverlapping.length; index += 1) {
    const match = nonOverlapping[index]!;
    const next = nonOverlapping[index + 1];
    const local = text.slice(match.end, next?.index ?? text.length);
    const generations = chassisValues(local);
    const values = generations.length ? generations : [null];
    for (const generation of values) {
      applications.push({ ...match, generation, ...years });
    }
  }
  const uniqueApplications = [...new Map(
    applications.map(({ make, model, generation, yearFrom, yearTo }) => [
      `${make}|${model}|${generation ?? "*"}|${yearFrom ?? "*"}|${yearTo ?? "*"}`,
      { make, model, generation, yearFrom, yearTo },
    ])
  ).values()];
  if (uniqueApplications.length === 0) issues.push("vehicle_application_unresolved");
  if (
    nonOverlapping.length > 1 &&
    uniqueApplications.some((application) => application.generation) &&
    uniqueApplications.some((application) => !application.generation)
  ) {
    issues.push("application_generation_correlation_ambiguous");
  }
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0];
  return {
    productId: product.id,
    variantId: variant?.id ?? "",
    variantSku: variant?.sku?.trim() ?? "",
    recordKey: `${product.id}:${product.sku}`,
    applications: uniqueApplications,
    verification: issues.length === 0 ? "VERIFIED" : "NEEDS_REVIEW",
    issues: [...new Set(issues)].sort(),
  };
}

export function buildAdroSourceRecordDraft(input: {
  product: AdroSnapshotProduct;
  sourceRevision: string;
}) {
  const normalization = normalizeAdroSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants.");
    const variant = variantField ? input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`ADRO variant provenance cannot resolve ${leaf.fieldPath}`);
    const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP";
    return {
      fieldPath: leaf.fieldPath,
      ordinal: leaf.ordinal,
      rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const),
      canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: legacyScope ? "scope" : variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value,
      mappingStatus: "MAPPED" as const,
      mapperVersion: "adro-snapshot-v1" as const,
      confidence: 1 as const,
      reason: legacyScope ? "audited LEGACY SHOP scope maps to auto" : null,
      productId: input.product.id,
      variantId: variant?.id ?? null,
    };
  });
  return {
    sourceRecord: {
      recordKey: normalization.recordKey,
      sourceRevision: input.sourceRevision,
      rawPayload: input.product,
      payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"),
      productId: input.product.id,
    },
    provenance,
    normalization,
    issues: normalization.issues.map((issue) => ({
      issueKey: `adro:${issue}`,
      code: issue.toUpperCase(),
      rawPath: issue === "fitment_text_missing" ? "title" : "$",
      details: { productId: input.product.id, supplierSku: input.product.sku },
    })),
  };
}
