/**
 * Deterministic Catalog V2 read-model builder. It owns no Prisma client,
 * clock, environment lookup, or persistence side effect; adapters supply one
 * canonical product and persist the returned compact rows separately.
 */
import { createHash } from "node:crypto";

import {
  SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS,
  validateShopCatalogV2CompatibilityPolicy,
  type ShopCatalogV2CompatibilityConstraint,
  type ShopCatalogV2CompatibilityDimension,
  type ShopCatalogV2CompatibilityMode,
  type ShopCatalogV2CompatibilityPolicy,
  type ShopCatalogV2CompatibilityValue,
  type ShopCatalogV2ConstraintState,
  type ShopCatalogV2YearRange,
} from "./shopCatalogV2Compatibility";
import { normalizeShopSearchText } from "./shopSearch";

export const SHOP_CATALOG_PROJECTION_SCHEMA_VERSION = 1 as const;
export const SHOP_CATALOG_PROJECTION_LOCALES = ["ua", "en"] as const;
export const SHOP_CATALOG_PROJECTION_FILTER_DIMENSIONS = [
  "brand",
  "make",
  "model",
  "generation",
  "year",
  "engine",
  "fuel",
] as const;

export const SHOP_CATALOG_PROJECTION_LIMITS = {
  batchSize: 500,
  derivedRowsPerBatch: 100_000,
  variantsPerProduct: 4_096,
  policiesPerProduct: 4_096,
  clausesPerProduct: 16_384,
  constraintRowsPerProduct: 65_536,
  exactValuesPerConstraint: 256,
  searchTermsPerLocale: 256,
  sharedSearchTerms: 256,
  tags: 512,
  collections: 512,
  identity: 320,
  title: 512,
  cardCopy: 2_048,
  searchText: 16_384,
  searchTerm: 256,
  mediaUrl: 4_096,
  sourceRef: 1_024,
} as const;

export type ShopCatalogProjectionLocale = (typeof SHOP_CATALOG_PROJECTION_LOCALES)[number];
export type ShopCatalogProjectionFilterDimension =
  (typeof SHOP_CATALOG_PROJECTION_FILTER_DIMENSIONS)[number];
export type ShopCatalogProjectionVersionInput = string | number | bigint;

export type ShopCatalogProjectionLocaleInput = {
  title: string;
  cardCopy?: string | null;
  searchTerms?: readonly string[];
};

export type ShopCatalogProjectionNamedFacetInput = {
  id?: string | null;
  key: string;
  labelUa: string;
  labelEn: string;
};

export type ShopCatalogProjectionPrimaryMediaInput = {
  assetId?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  version?: string | null;
};

export type ShopCatalogProjectionVariantInput = {
  variantId: string;
  sku?: string | null;
  isDefault?: boolean;
  stableRank: number;
};

export type ShopCatalogProjectionSource = {
  productId: string;
  sourceVersion: ShopCatalogProjectionVersionInput;
  catalogVersion?: ShopCatalogProjectionVersionInput;
  sourceUpdatedAt?: Date | string | null;
  canonicalContentHash: string;
  canonicalRelationCounts: Readonly<Record<string, number>>;
  slug: string;
  sku?: string | null;
  scopeKey: string;
  statusKey: string;
  stockKey: string;
  isPublished: boolean;
  stableRank: number;
  brand: ShopCatalogProjectionNamedFacetInput;
  category?: ShopCatalogProjectionNamedFacetInput | null;
  productTypeKey?: string | null;
  productKindKey?: string | null;
  categoryGroupKey?: string | null;
  locales: Readonly<Record<ShopCatalogProjectionLocale, ShopCatalogProjectionLocaleInput>>;
  primaryMedia?: ShopCatalogProjectionPrimaryMediaInput | null;
  tags?: readonly string[];
  collectionKeys?: readonly string[];
  sharedSearchTerms?: readonly string[];
  variants?: readonly ShopCatalogProjectionVariantInput[];
  compatibilityPolicies?: readonly ShopCatalogV2CompatibilityPolicy[];
};

export type ShopCatalogProjectionMediaRecord = {
  assetId: string | null;
  url: string;
  width: number | null;
  height: number | null;
  version: string | null;
};

export type ShopCatalogProjectionRecord = {
  schemaVersion: typeof SHOP_CATALOG_PROJECTION_SCHEMA_VERSION;
  productId: string;
  locale: ShopCatalogProjectionLocale;
  sourceVersion: string;
  catalogVersion: string;
  projectionVersion: string;
  sourceUpdatedAt: string | null;
  sourceContentHash: string;
  canonicalRelationHash: string;
  compatibilityHash: string;
  slug: string;
  scopeKey: string;
  statusKey: string;
  stockKey: string;
  isPublished: boolean;
  stableRank: number;
  normalizedSku: string | null;
  brandId: string | null;
  brandKey: string;
  brandLabel: string;
  categoryId: string | null;
  categoryKey: string | null;
  categoryLabel: string | null;
  productTypeKey: string | null;
  productKindKey: string | null;
  categoryGroupKey: string | null;
  title: string;
  cardCopy: string | null;
  searchText: string;
  primaryMedia: ShopCatalogProjectionMediaRecord | null;
  contentHash: string;
};

export type ShopCatalogProjectionSkuRecord = {
  productId: string;
  variantId: string | null;
  sourceVersion: string;
  sku: string;
  normalizedSku: string;
  isDefault: boolean;
  stableRank: number;
};

export type ShopCatalogProjectionPolicyRecord = {
  productId: string;
  variantId: string | null;
  parentProductId: string | null;
  parentVariantId: string | null;
  mode: ShopCatalogV2CompatibilityMode;
  sourceVersion: string;
  requiredDimensions: readonly ShopCatalogV2CompatibilityDimension[];
  dimensionDefaults: readonly {
    dimension: ShopCatalogV2CompatibilityDimension;
    state: Exclude<ShopCatalogV2ConstraintState, "EXACT">;
  }[];
  clauseCount: number;
};

export type ShopCatalogProjectionClauseRecord = {
  productId: string;
  variantId: string | null;
  sourceVersion: string;
  clauseId: string;
  verification: "VERIFIED" | "INFERRED" | "NEEDS_REVIEW";
  sourceRef: string | null;
};

export type ShopCatalogProjectionConstraintValue =
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "boolean"; boolean: boolean }
  | { kind: "year_range"; yearFrom: number | null; yearTo: number | null };

export type ShopCatalogProjectionConstraintRecord = {
  productId: string;
  variantId: string | null;
  sourceVersion: string;
  clauseId: string;
  dimension: ShopCatalogV2CompatibilityDimension;
  state: ShopCatalogV2ConstraintState;
  valueOrdinal: number;
  value: ShopCatalogProjectionConstraintValue | null;
};

export type ShopCatalogProjectionBuild = {
  schemaVersion: typeof SHOP_CATALOG_PROJECTION_SCHEMA_VERSION;
  productId: string;
  sourceVersion: string;
  catalogVersion: string;
  projectionVersion: string;
  sourceUpdatedAt: string | null;
  sourceContentHash: string;
  canonicalRelationHash: string;
  canonicalRelationCounts: readonly { relation: string; count: number }[];
  projections: readonly ShopCatalogProjectionRecord[];
  skuRecords: readonly ShopCatalogProjectionSkuRecord[];
  compatibilityPolicies: readonly ShopCatalogProjectionPolicyRecord[];
  compatibilityClauses: readonly ShopCatalogProjectionClauseRecord[];
  compatibilityConstraints: readonly ShopCatalogProjectionConstraintRecord[];
  contentHash: string;
};

export type ShopCatalogProjectionBatch = {
  schemaVersion: typeof SHOP_CATALOG_PROJECTION_SCHEMA_VERSION;
  products: readonly ShopCatalogProjectionBuild[];
  productCount: number;
  derivedRowCount: number;
  nextCursor: string | null;
  contentHash: string;
};

const DIMENSION_ORDER = new Map(
  SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.map((dimension, index) => [dimension, index])
);

function fail(message: string): never {
  throw new TypeError(`Invalid ShopCatalogProjection source: ${message}`);
}

function requiredText(
  value: string,
  field: string,
  maxLength: number = SHOP_CATALOG_PROJECTION_LIMITS.identity
) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} is required`);
  if (value.length > maxLength) fail(`${field} exceeds ${maxLength} characters`);
  return value;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number = SHOP_CATALOG_PROJECTION_LIMITS.identity
) {
  if (value === null || value === undefined || value === "") return null;
  return requiredText(value, field, maxLength);
}

function normalizeVersion(value: ShopCatalogProjectionVersionInput, field: string) {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
    return fail(`${field} must be a non-negative safe integer or decimal string`);
  }
  try {
    const normalized = BigInt(value);
    if (normalized < BigInt(0)) fail(`${field} must be a non-negative integer`);
    return normalized.toString();
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith("Invalid ShopCatalogProjection")) {
      throw error;
    }
    return fail(`${field} must be a non-negative integer`);
  }
}

function normalizedTimestamp(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return fail("sourceUpdatedAt must be a valid timestamp");
  return date.toISOString();
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function hashValue(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function sortDimension(
  left: ShopCatalogV2CompatibilityDimension,
  right: ShopCatalogV2CompatibilityDimension
) {
  return (
    (DIMENSION_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (DIMENSION_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

function compactSku(value: string | null | undefined) {
  const compact = String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return compact || null;
}

function uniqueSortedText(
  values: readonly string[] | undefined,
  field: string,
  maxItems: number,
  maxLength: number = SHOP_CATALOG_PROJECTION_LIMITS.searchTerm
) {
  if ((values?.length ?? 0) > maxItems) fail(`${field} exceeds ${maxItems} items`);
  const result = new Set<string>();
  for (const [index, value] of (values ?? []).entries()) {
    const checked = requiredText(value, `${field}.${index}`, maxLength);
    result.add(checked);
  }
  return [...result].sort((left, right) => left.localeCompare(right, "en"));
}

function normalizedRelationCounts(counts: Readonly<Record<string, number>>) {
  return Object.entries(counts)
    .map(([relation, count]) => {
      requiredText(relation, `canonicalRelationCounts.${relation}`, 120);
      if (!Number.isSafeInteger(count) || count < 0) {
        fail(`canonicalRelationCounts.${relation} must be a non-negative integer`);
      }
      return { relation, count };
    })
    .sort((left, right) => left.relation.localeCompare(right.relation, "en"));
}

function normalizedNamedFacet(value: ShopCatalogProjectionNamedFacetInput, field: string) {
  return {
    id: optionalText(value.id, `${field}.id`),
    key: requiredText(value.key, `${field}.key`),
    labelUa: requiredText(value.labelUa, `${field}.labelUa`, SHOP_CATALOG_PROJECTION_LIMITS.title),
    labelEn: requiredText(value.labelEn, `${field}.labelEn`, SHOP_CATALOG_PROJECTION_LIMITS.title),
  };
}

function normalizedPrimaryMedia(
  value: ShopCatalogProjectionPrimaryMediaInput | null | undefined
): ShopCatalogProjectionMediaRecord | null {
  if (!value) return null;
  const dimension = (number: number | null | undefined, field: string) => {
    if (number === null || number === undefined) return null;
    if (!Number.isSafeInteger(number) || number <= 0) fail(`${field} must be a positive integer`);
    return number;
  };
  return {
    assetId: optionalText(value.assetId, "primaryMedia.assetId"),
    url: requiredText(value.url, "primaryMedia.url", SHOP_CATALOG_PROJECTION_LIMITS.mediaUrl),
    width: dimension(value.width, "primaryMedia.width"),
    height: dimension(value.height, "primaryMedia.height"),
    version: optionalText(value.version, "primaryMedia.version"),
  };
}

function isYearRange(value: ShopCatalogV2CompatibilityValue): value is ShopCatalogV2YearRange {
  return typeof value === "object" && value !== null && "from" in value && "to" in value;
}

function normalizedConstraintValue(
  value: ShopCatalogV2CompatibilityValue,
  field: string
): ShopCatalogProjectionConstraintValue {
  if (isYearRange(value)) {
    return { kind: "year_range", yearFrom: value.from, yearTo: value.to };
  }
  if (typeof value === "string") {
    return {
      kind: "text",
      text: requiredText(value, field, SHOP_CATALOG_PROJECTION_LIMITS.searchTerm),
    };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(`${field} must be finite`);
    return { kind: "number", number: value };
  }
  return { kind: "boolean", boolean: value };
}

function constraintValueKey(value: ShopCatalogProjectionConstraintValue) {
  if (value.kind === "text") return `0:${value.text}`;
  if (value.kind === "number") return `1:${value.number}`;
  if (value.kind === "boolean") return `2:${value.boolean ? 1 : 0}`;
  return `3:${value.yearFrom ?? ""}:${value.yearTo ?? ""}`;
}

function normalizedConstraintRows(input: {
  productId: string;
  variantId: string | null;
  sourceVersion: string;
  clauseId: string;
  constraint: ShopCatalogV2CompatibilityConstraint;
}) {
  const base = {
    productId: input.productId,
    variantId: input.variantId,
    sourceVersion: input.sourceVersion,
    clauseId: input.clauseId,
    dimension: input.constraint.dimension,
    state: input.constraint.state,
  };
  if (input.constraint.state !== "EXACT") {
    return [
      { ...base, valueOrdinal: 0, value: null } satisfies ShopCatalogProjectionConstraintRecord,
    ];
  }
  if (input.constraint.values.length > SHOP_CATALOG_PROJECTION_LIMITS.exactValuesPerConstraint) {
    fail(
      `clause ${input.clauseId} ${input.constraint.dimension} exceeds ` +
        `${SHOP_CATALOG_PROJECTION_LIMITS.exactValuesPerConstraint} exact values`
    );
  }
  return input.constraint.values
    .map((value, index) =>
      normalizedConstraintValue(
        value,
        `clause.${input.clauseId}.${input.constraint.dimension}.values.${index}`
      )
    )
    .sort((left, right) => constraintValueKey(left).localeCompare(constraintValueKey(right), "en"))
    .map(
      (value, valueOrdinal) =>
        ({ ...base, valueOrdinal, value }) satisfies ShopCatalogProjectionConstraintRecord
    );
}

function normalizedCompatibility(input: {
  productId: string;
  sourceVersion: string;
  variantIds: ReadonlySet<string>;
  policies: readonly ShopCatalogV2CompatibilityPolicy[];
}) {
  if (input.policies.length > SHOP_CATALOG_PROJECTION_LIMITS.policiesPerProduct) {
    fail(
      `compatibilityPolicies exceeds ${SHOP_CATALOG_PROJECTION_LIMITS.policiesPerProduct} items`
    );
  }

  const targets = new Set<string>();
  const policies: ShopCatalogProjectionPolicyRecord[] = [];
  const clauses: ShopCatalogProjectionClauseRecord[] = [];
  const constraints: ShopCatalogProjectionConstraintRecord[] = [];

  for (const policy of input.policies) {
    const errors = validateShopCatalogV2CompatibilityPolicy(policy);
    if (errors.length) fail(`compatibility policy is invalid: ${errors.join("; ")}`);
    if (policy.target.productId !== input.productId) {
      fail(`compatibility policy target ${policy.target.productId} does not match productId`);
    }
    const variantId = policy.target.variantId?.trim() || null;
    if (variantId && !input.variantIds.has(variantId)) {
      fail(`compatibility policy references unknown variant ${variantId}`);
    }
    const targetKey = variantId ?? "$product";
    if (targets.has(targetKey)) fail(`duplicate compatibility policy target ${targetKey}`);
    targets.add(targetKey);

    const dimensionDefaults = Object.entries(policy.dimensionDefaults ?? {})
      .map(([dimension, state]) => {
        if (!DIMENSION_ORDER.has(dimension as ShopCatalogV2CompatibilityDimension)) {
          fail(`compatibility policy has unknown default dimension ${dimension}`);
        }
        if (state !== "ANY" && state !== "NOT_APPLICABLE" && state !== "UNKNOWN") {
          fail(`compatibility policy has invalid default state ${String(state)}`);
        }
        return {
          dimension: dimension as ShopCatalogV2CompatibilityDimension,
          state,
        };
      })
      .sort((left, right) => sortDimension(left.dimension, right.dimension));
    const sortedClauses = [...policy.clauses].sort((left, right) =>
      left.id.localeCompare(right.id, "en")
    );
    policies.push({
      productId: input.productId,
      variantId,
      parentProductId: policy.parentTarget?.productId.trim() || null,
      parentVariantId: policy.parentTarget?.variantId?.trim() || null,
      mode: policy.mode,
      sourceVersion: input.sourceVersion,
      requiredDimensions: [...policy.requiredDimensions].sort(sortDimension),
      dimensionDefaults,
      clauseCount: sortedClauses.length,
    });

    for (const clause of sortedClauses) {
      const clauseId = requiredText(
        clause.id,
        "compatibility clause id",
        SHOP_CATALOG_PROJECTION_LIMITS.identity
      );
      clauses.push({
        productId: input.productId,
        variantId,
        sourceVersion: input.sourceVersion,
        clauseId,
        verification: clause.verification,
        sourceRef: optionalText(
          clause.sourceRef,
          `clause.${clauseId}.sourceRef`,
          SHOP_CATALOG_PROJECTION_LIMITS.sourceRef
        ),
      });
      for (const constraint of [...clause.constraints].sort((left, right) =>
        sortDimension(left.dimension, right.dimension)
      )) {
        constraints.push(
          ...normalizedConstraintRows({
            productId: input.productId,
            variantId,
            sourceVersion: input.sourceVersion,
            clauseId,
            constraint,
          })
        );
      }
    }
  }

  if (clauses.length > SHOP_CATALOG_PROJECTION_LIMITS.clausesPerProduct) {
    fail(`compatibility clauses exceeds ${SHOP_CATALOG_PROJECTION_LIMITS.clausesPerProduct} rows`);
  }
  if (constraints.length > SHOP_CATALOG_PROJECTION_LIMITS.constraintRowsPerProduct) {
    fail(
      `compatibility constraints exceeds ` +
        `${SHOP_CATALOG_PROJECTION_LIMITS.constraintRowsPerProduct} rows`
    );
  }

  const targetSort = <T extends { variantId: string | null }>(left: T, right: T) =>
    (left.variantId ?? "").localeCompare(right.variantId ?? "", "en");
  policies.sort(targetSort);
  clauses.sort(
    (left, right) => targetSort(left, right) || left.clauseId.localeCompare(right.clauseId, "en")
  );
  constraints.sort(
    (left, right) =>
      targetSort(left, right) ||
      left.clauseId.localeCompare(right.clauseId, "en") ||
      sortDimension(left.dimension, right.dimension) ||
      left.valueOrdinal - right.valueOrdinal
  );
  return { policies, clauses, constraints };
}

function normalizedVariants(
  productId: string,
  sourceVersion: string,
  productSku: string | null,
  variants: readonly ShopCatalogProjectionVariantInput[]
) {
  if (variants.length > SHOP_CATALOG_PROJECTION_LIMITS.variantsPerProduct) {
    fail(`variants exceeds ${SHOP_CATALOG_PROJECTION_LIMITS.variantsPerProduct} items`);
  }
  const ids = new Set<string>();
  const records: ShopCatalogProjectionSkuRecord[] = [];
  if (productSku) {
    records.push({
      productId,
      variantId: null,
      sourceVersion,
      sku: productSku,
      normalizedSku: compactSku(productSku)!,
      isDefault: false,
      stableRank: -1,
    });
  }
  for (const [index, variant] of variants.entries()) {
    const variantId = requiredText(variant.variantId, `variants.${index}.variantId`);
    if (ids.has(variantId)) fail(`duplicate variantId ${variantId}`);
    ids.add(variantId);
    if (!Number.isSafeInteger(variant.stableRank)) {
      fail(`variants.${index}.stableRank must be a safe integer`);
    }
    const sku = optionalText(variant.sku, `variants.${index}.sku`);
    const normalizedSku = compactSku(sku);
    if (!sku || !normalizedSku) continue;
    records.push({
      productId,
      variantId,
      sourceVersion,
      sku,
      normalizedSku,
      isDefault: variant.isDefault === true,
      stableRank: variant.stableRank,
    });
  }
  records.sort(
    (left, right) =>
      left.stableRank - right.stableRank ||
      (left.variantId ?? "").localeCompare(right.variantId ?? "", "en") ||
      left.normalizedSku.localeCompare(right.normalizedSku, "en")
  );
  return { records, variantIds: ids };
}

function buildSearchText(input: {
  locale: ShopCatalogProjectionLocale;
  title: string;
  cardCopy: string | null;
  sku: string | null;
  skuRecords: readonly ShopCatalogProjectionSkuRecord[];
  brand: ReturnType<typeof normalizedNamedFacet>;
  category: ReturnType<typeof normalizedNamedFacet> | null;
  productTypeKey: string | null;
  productKindKey: string | null;
  categoryGroupKey: string | null;
  tags: readonly string[];
  collectionKeys: readonly string[];
  sharedSearchTerms: readonly string[];
  localeSearchTerms: readonly string[];
  compatibilityConstraints: readonly ShopCatalogProjectionConstraintRecord[];
}) {
  const compatibilityTerms = input.compatibilityConstraints.flatMap((constraint) => {
    if (constraint.value?.kind === "text") return [constraint.value.text];
    if (constraint.value?.kind === "number") return [String(constraint.value.number)];
    if (constraint.value?.kind === "year_range") {
      return [constraint.value.yearFrom, constraint.value.yearTo]
        .filter((value): value is number => value !== null)
        .map(String);
    }
    return [];
  });
  const text = normalizeShopSearchText(
    [
      input.title,
      input.cardCopy,
      input.sku,
      ...input.skuRecords.flatMap((record) => [record.sku, record.normalizedSku]),
      input.brand.key,
      input.locale === "ua" ? input.brand.labelUa : input.brand.labelEn,
      input.category?.key,
      input.category && (input.locale === "ua" ? input.category.labelUa : input.category.labelEn),
      input.productTypeKey,
      input.productKindKey,
      input.categoryGroupKey,
      ...input.tags,
      ...input.collectionKeys,
      ...input.sharedSearchTerms,
      ...input.localeSearchTerms,
      ...compatibilityTerms,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
  );
  if (text.length > SHOP_CATALOG_PROJECTION_LIMITS.searchText) {
    fail(`locales.${input.locale}.searchText exceeds ${SHOP_CATALOG_PROJECTION_LIMITS.searchText}`);
  }
  return text;
}

export function buildShopCatalogProjection(
  source: ShopCatalogProjectionSource
): ShopCatalogProjectionBuild {
  const productId = requiredText(source.productId, "productId");
  const sourceVersion = normalizeVersion(source.sourceVersion, "sourceVersion");
  const catalogVersion = normalizeVersion(
    source.catalogVersion ?? source.sourceVersion,
    "catalogVersion"
  );
  const sourceUpdatedAt = normalizedTimestamp(source.sourceUpdatedAt);
  const sourceContentHash = requiredText(source.canonicalContentHash, "canonicalContentHash", 256);
  const canonicalRelationCounts = normalizedRelationCounts(source.canonicalRelationCounts);
  const canonicalRelationHash = hashValue(canonicalRelationCounts);
  const slug = requiredText(source.slug, "slug");
  const sku = optionalText(source.sku, "sku");
  const normalizedSku = compactSku(sku);
  if (sku && !normalizedSku) fail("sku must contain at least one ASCII letter or digit");
  const scopeKey = requiredText(source.scopeKey, "scopeKey");
  const statusKey = requiredText(source.statusKey, "statusKey");
  const stockKey = requiredText(source.stockKey, "stockKey");
  if (!Number.isSafeInteger(source.stableRank)) fail("stableRank must be a safe integer");
  const brand = normalizedNamedFacet(source.brand, "brand");
  const category = source.category ? normalizedNamedFacet(source.category, "category") : null;
  const productTypeKey = optionalText(source.productTypeKey, "productTypeKey");
  const productKindKey = optionalText(source.productKindKey, "productKindKey");
  const categoryGroupKey = optionalText(source.categoryGroupKey, "categoryGroupKey");
  const primaryMedia = normalizedPrimaryMedia(source.primaryMedia);
  const tags = uniqueSortedText(source.tags, "tags", SHOP_CATALOG_PROJECTION_LIMITS.tags);
  const collectionKeys = uniqueSortedText(
    source.collectionKeys,
    "collectionKeys",
    SHOP_CATALOG_PROJECTION_LIMITS.collections
  );
  const sharedSearchTerms = uniqueSortedText(
    source.sharedSearchTerms,
    "sharedSearchTerms",
    SHOP_CATALOG_PROJECTION_LIMITS.sharedSearchTerms
  );
  const variants = source.variants ?? [];
  const normalizedVariantResult = normalizedVariants(productId, sourceVersion, sku, variants);
  const compatibility = normalizedCompatibility({
    productId,
    sourceVersion,
    variantIds: normalizedVariantResult.variantIds,
    policies: source.compatibilityPolicies ?? [],
  });
  const compatibilityHash = hashValue({
    policies: compatibility.policies,
    clauses: compatibility.clauses,
    constraints: compatibility.constraints,
  });

  const projections = SHOP_CATALOG_PROJECTION_LOCALES.map((locale) => {
    const localeInput = source.locales[locale];
    if (!localeInput) fail(`locales.${locale} is required`);
    const title = requiredText(
      localeInput.title,
      `locales.${locale}.title`,
      SHOP_CATALOG_PROJECTION_LIMITS.title
    );
    const cardCopy = optionalText(
      localeInput.cardCopy,
      `locales.${locale}.cardCopy`,
      SHOP_CATALOG_PROJECTION_LIMITS.cardCopy
    );
    const localeSearchTerms = uniqueSortedText(
      localeInput.searchTerms,
      `locales.${locale}.searchTerms`,
      SHOP_CATALOG_PROJECTION_LIMITS.searchTermsPerLocale
    );
    const base = {
      schemaVersion: SHOP_CATALOG_PROJECTION_SCHEMA_VERSION,
      productId,
      locale,
      sourceVersion,
      catalogVersion,
      projectionVersion: catalogVersion,
      sourceUpdatedAt,
      sourceContentHash,
      canonicalRelationHash,
      compatibilityHash,
      slug,
      scopeKey,
      statusKey,
      stockKey,
      isPublished: source.isPublished,
      stableRank: source.stableRank,
      normalizedSku,
      brandId: brand.id,
      brandKey: brand.key,
      brandLabel: locale === "ua" ? brand.labelUa : brand.labelEn,
      categoryId: category?.id ?? null,
      categoryKey: category?.key ?? null,
      categoryLabel: category ? (locale === "ua" ? category.labelUa : category.labelEn) : null,
      productTypeKey,
      productKindKey,
      categoryGroupKey,
      title,
      cardCopy,
      searchText: buildSearchText({
        locale,
        title,
        cardCopy,
        sku,
        skuRecords: normalizedVariantResult.records,
        brand,
        category,
        productTypeKey,
        productKindKey,
        categoryGroupKey,
        tags,
        collectionKeys,
        sharedSearchTerms,
        localeSearchTerms,
        compatibilityConstraints: compatibility.constraints,
      }),
      primaryMedia,
    } satisfies Omit<ShopCatalogProjectionRecord, "contentHash">;
    return { ...base, contentHash: hashValue(base) } satisfies ShopCatalogProjectionRecord;
  });

  const baseBuild = {
    schemaVersion: SHOP_CATALOG_PROJECTION_SCHEMA_VERSION,
    productId,
    sourceVersion,
    catalogVersion,
    projectionVersion: catalogVersion,
    sourceUpdatedAt,
    sourceContentHash,
    canonicalRelationHash,
    canonicalRelationCounts,
    projections,
    skuRecords: normalizedVariantResult.records,
    compatibilityPolicies: compatibility.policies,
    compatibilityClauses: compatibility.clauses,
    compatibilityConstraints: compatibility.constraints,
  } satisfies Omit<ShopCatalogProjectionBuild, "contentHash">;

  return deepFreeze({ ...baseBuild, contentHash: hashValue(baseBuild) });
}

/**
 * Builds one keyset-sized batch. Callers own canonical reads and persistence;
 * this pure function never loads or retains a full catalog.
 */
export function buildShopCatalogProjectionBatch(
  sources: readonly ShopCatalogProjectionSource[]
): ShopCatalogProjectionBatch {
  if (sources.length > SHOP_CATALOG_PROJECTION_LIMITS.batchSize) {
    fail(`batch exceeds ${SHOP_CATALOG_PROJECTION_LIMITS.batchSize} products`);
  }
  const sortedSources = [...sources].sort((left, right) =>
    left.productId.localeCompare(right.productId, "en")
  );
  const productIds = new Set<string>();
  let derivedRowCount = 0;
  const products = sortedSources.map((source) => {
    if (productIds.has(source.productId))
      fail(`batch contains duplicate productId ${source.productId}`);
    productIds.add(source.productId);
    const product = buildShopCatalogProjection(source);
    derivedRowCount +=
      product.projections.length +
      product.skuRecords.length +
      product.compatibilityPolicies.length +
      product.compatibilityClauses.length +
      product.compatibilityConstraints.length;
    if (derivedRowCount > SHOP_CATALOG_PROJECTION_LIMITS.derivedRowsPerBatch) {
      fail(
        `batch derived rows exceeds ${SHOP_CATALOG_PROJECTION_LIMITS.derivedRowsPerBatch}; ` +
          "reduce the keyset page size"
      );
    }
    return product;
  });
  const base = {
    schemaVersion: SHOP_CATALOG_PROJECTION_SCHEMA_VERSION,
    products,
    productCount: products.length,
    derivedRowCount,
    nextCursor: products.at(-1)?.productId ?? null,
  };
  return deepFreeze({ ...base, contentHash: hashValue(base) });
}
