import { createHash } from "node:crypto";

import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type RaceChipSnapshotProduct = {
  id: string;
  slug: string;
  sku: string;
  scope?: string;
  tags: string[];
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>;
  [key: string]: unknown;
};

export type RaceChipFuel = "diesel" | "petrol" | "hybrid";

export type RaceChipNormalization = {
  productId: string;
  recordKey: string;
  variantId: string;
  variantSku: string;
  make: string;
  model: string;
  generation: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineDescriptor: string;
  displacementCcm: number;
  baseHp: number;
  gainHp: number;
  gainNm: number;
  fuel: RaceChipFuel | null;
  configurationKey: string;
  verification: "VERIFIED" | "NEEDS_REVIEW";
  issues: string[];
};

export type RaceChipSourceRecordDraft = {
  sourceRecord: {
    recordKey: string;
    sourceRevision: string;
    rawPayload: RaceChipSnapshotProduct;
    payloadHash: string;
    productId: string;
  };
  provenance: Array<{
    fieldPath: string;
    ordinal: number;
    rawValue: unknown;
    canonicalEntityType: "PRODUCT" | "VARIANT";
    canonicalEntityId: string;
    canonicalField: string;
    normalizedValue: unknown;
    mappingStatus: "MAPPED";
    mapperVersion: "racechip-snapshot-v1";
    confidence: 1;
    reason: string | null;
    productId: string;
    variantId: string | null;
  }>;
  normalization: RaceChipNormalization;
  issues: Array<{
    issueKey: string;
    code: string;
    rawPath: string;
    details: Record<string, unknown>;
  }>;
};

function tagValues(tags: readonly string[], key: string) {
  const prefix = `${key}:`;
  return tags.filter((tag) => tag.startsWith(prefix)).map((tag) => tag.slice(prefix.length));
}

function uniqueTag(tags: readonly string[], key: string, issues: string[]) {
  const values = [...new Set(tagValues(tags, key).map((value) => value.trim()).filter(Boolean))];
  if (values.length !== 1) issues.push(`${key}_${values.length === 0 ? "missing" : "ambiguous"}`);
  return values.length === 1 ? values[0]! : null;
}

function positiveInteger(value: string | null, key: string, issues: string[]) {
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    issues.push(`${key}_invalid`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    issues.push(`${key}_invalid`);
    return null;
  }
  return parsed;
}

function parseYears(value: string) {
  const range = /-(19|20)(\d{2})-to-(19|20)(\d{2})$/.exec(value);
  if (range) return { yearFrom: Number(`${range[1]}${range[2]}`), yearTo: Number(`${range[3]}${range[4]}`) };
  const from = /-from-(19|20)(\d{2})$/.exec(value);
  if (from) return { yearFrom: Number(`${from[1]}${from[2]}`), yearTo: null };
  return { yearFrom: null, yearTo: null };
}

export function classifyRaceChipFuel(engineDescriptor: string): RaceChipFuel | null {
  const value = `-${engineDescriptor.toLowerCase()}-`;
  const hybrid = /(?:phev|plug-in-hybrid|hybrid)/.test(value);
  if (hybrid) return "hybrid";
  const diesel = /(?:tdi|tdci|cdi|cdti|dci|hdi|crdi|jtd|multijet|skyactiv-d|skyaktiv-d|diesel|ecoblue|bluetec|tdv6|sdv6|d-4d|di-d|mzr-cd|xdi|crd|hpi|td4|drive-d|(?:^|-)cooper-(?:s?d)(?:-|$)|(?:^|-)(?:(?:[1-9][0-9]{0,2})d|d[2-6]|d)(?:-|$))/.test(value);
  const petrol = /(?:tfsi|tsi|t-gdi|gdi|mpi|ecoboost|skyactiv-g|skyaktiv-g|petrol|gasoline|thp|puretech|gti|tbi|sidi|twinair|abarth|jcw|(?:^|-)cooper-s(?:-|$)|(?:^|-)(?:[1-9][0-9]{0,2})i(?:-|$))/.test(value);
  if (diesel === petrol) return null;
  return diesel ? "diesel" : "petrol";
}

export function normalizeRaceChipSnapshotProduct(
  product: RaceChipSnapshotProduct
): RaceChipNormalization {
  const issues: string[] = [];
  const make = uniqueTag(product.tags, "car_make", issues);
  const fitMake = uniqueTag(product.tags, "fits-make", issues);
  const modelTag = uniqueTag(product.tags, "car_model", issues);
  const fitModel = uniqueTag(product.tags, "fits-model", issues);
  const engine = uniqueTag(product.tags, "car_engine", issues);
  const fitTrim = tagValues(product.tags, "fits-trim")[0] ?? null;
  const displacementCcm = positiveInteger(uniqueTag(product.tags, "ccm", issues), "ccm", issues);
  const baseHp = positiveInteger(uniqueTag(product.tags, "base_hp", issues), "base_hp", issues);
  const gainHp = positiveInteger(uniqueTag(product.tags, "gain_hp", issues), "gain_hp", issues);
  const gainNm = positiveInteger(uniqueTag(product.tags, "gain_nm", issues), "gain_nm", issues);
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim());
  if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous");
  const variant = variants[0] ?? null;

  const modelParts = fitModel?.split(":") ?? [];
  const canonicalMake = modelParts.length >= 2 ? modelParts[0]! : null;
  const model = modelParts.length >= 2 ? modelParts.slice(1).join(":") : null;
  if (!make || !fitMake || make !== fitMake || make !== canonicalMake) issues.push("make_conflict");
  if (!model) issues.push("model_missing");
  const trimParts = fitTrim?.split(":") ?? [];
  const generation =
    trimParts.length >= 3 && trimParts[0] === make && trimParts[1] === model
      ? trimParts.slice(2).join(":")
      : null;
  if (fitTrim && !generation) issues.push("generation_conflict");
  const years = modelTag ? parseYears(modelTag) : { yearFrom: null, yearTo: null };
  if (!years.yearFrom) issues.push("year_range_unknown");
  const fuel = engine ? classifyRaceChipFuel(engine) : null;
  if (!fuel) issues.push("fuel_unknown_or_ambiguous");
  const hardMissing =
    !make || !model || !engine || !variant?.sku || !displacementCcm || !baseHp || !gainHp || !gainNm;
  if (hardMissing) issues.push("required_identity_or_engine_field_missing");
  const configurationKey = [
    make ?? "unknown-make",
    model ?? "unknown-model",
    generation ?? "any-generation",
    years.yearFrom ? `${years.yearFrom}-${years.yearTo ?? "open"}` : "unknown-year",
    engine ?? "unknown-engine",
    fuel ?? "unknown-fuel",
  ].join("|");
  return {
    productId: product.id,
    // Supplier SKUs repeat across different vehicle applications. Product ID
    // is part of source identity so two compatible vehicles never collapse.
    recordKey: `${product.id}:${product.sku}`,
    variantId: variant?.id ?? "",
    variantSku: variant?.sku?.trim() ?? "",
    make: make ?? "",
    model: model ?? "",
    generation,
    yearFrom: years.yearFrom,
    yearTo: years.yearTo,
    engineDescriptor: engine ?? "",
    displacementCcm: displacementCcm ?? 0,
    baseHp: baseHp ?? 0,
    gainHp: gainHp ?? 0,
    gainNm: gainNm ?? 0,
    fuel,
    configurationKey,
    verification: issues.length === 0 ? "VERIFIED" : "NEEDS_REVIEW",
    issues: [...new Set(issues)].sort(),
  };
}

export function buildRaceChipSourceRecordDraft(input: {
  product: RaceChipSnapshotProduct;
  sourceRevision: string;
}): RaceChipSourceRecordDraft {
  const normalization = normalizeRaceChipSnapshotProduct(input.product);
  const leaves = flattenShopCatalogRawPayload(input.product);
  const provenance = leaves.map((leaf) => {
    const variantField = leaf.fieldPath.startsWith("variants.");
    const variant = variantField ? input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) {
      throw new Error(`RaceChip variant provenance cannot resolve ${leaf.fieldPath}[${leaf.ordinal}]`);
    }
    const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP";
    return {
      fieldPath: leaf.fieldPath,
      ordinal: leaf.ordinal,
      rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const),
      canonicalEntityId: variant?.id ?? input.product.id,
      canonicalField: legacyScope
        ? "scope"
        : variantField
          ? leaf.fieldPath.slice("variants.".length)
          : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value,
      mappingStatus: "MAPPED" as const,
      mapperVersion: "racechip-snapshot-v1" as const,
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
      issueKey: `racechip:${issue}`,
      code: issue.toUpperCase(),
      rawPath: issue === "fuel_unknown_or_ambiguous" ? "tags" : "$",
      details: {
        productId: input.product.id,
        supplierSku: input.product.sku,
        configurationKey: normalization.configurationKey,
        engineDescriptor: normalization.engineDescriptor,
      },
    })),
  };
}
