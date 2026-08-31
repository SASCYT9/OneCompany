import "server-only";

/** Pure, bounded comparison contracts for projection rebuild and shadow reads. */
import { createHash } from "node:crypto";

import {
  buildShopCatalogProjection,
  SHOP_CATALOG_PROJECTION_FILTER_DIMENSIONS,
  type ShopCatalogProjectionBuild,
  type ShopCatalogProjectionFilterDimension,
  type ShopCatalogProjectionSource,
} from "./shopCatalogProjection.server";

export const SHOP_CATALOG_SHADOW_PARITY_VERSION = 1 as const;
export const SHOP_CATALOG_SHADOW_PARITY_LIMITS = {
  comparedItems: 100,
  facetValues: 10_000,
  differenceSamples: 25,
} as const;

export type ShopCatalogProjectionSectionName =
  | "projections"
  | "skuRecords"
  | "compatibilityPolicies"
  | "compatibilityClauses"
  | "compatibilityConstraints";

export type ShopCatalogProjectionSectionParity = {
  matches: boolean;
  expectedCount: number;
  actualCount: number;
  missingCount: number;
  unexpectedCount: number;
  changedCount: number;
  duplicateExpectedKeys: readonly string[];
  duplicateActualKeys: readonly string[];
  missingKeys: readonly string[];
  unexpectedKeys: readonly string[];
  changedKeys: readonly string[];
  samplesTruncated: boolean;
};

export type ShopCatalogProjectionParityReport = {
  version: typeof SHOP_CATALOG_SHADOW_PARITY_VERSION;
  parity: boolean;
  /**
   * Projection equality covers only card/search/filter fields. Canonical data
   * remains outside the compact projection and is guarded by the immutable
   * loss-ledger content hash and relation counts carried by every build.
   */
  projectionContract: "COMPACT_WITH_CANONICAL_LOSS_LEDGER_REFERENCE";
  canonicalDataEmbedded: false;
  productIdentityMatch: boolean;
  sourceVersionMatch: boolean;
  catalogVersionMatch: boolean;
  projectionVersionMatch: boolean;
  projectedFieldsMatch: boolean;
  canonicalLossLedgerReferenceMatch: boolean;
  sourceContentHashMatch: boolean;
  canonicalRelationHashMatch: boolean;
  canonicalRelationCountsMatch: boolean;
  buildContentHashMatch: boolean;
  expectedBuildHash: string;
  actualBuildHash: string;
  sections: Readonly<Record<ShopCatalogProjectionSectionName, ShopCatalogProjectionSectionParity>>;
};

export type ShopCatalogProjectionReplacementDecision = {
  apply: boolean;
  reason:
    | "INSERT"
    | "NEWER_VERSION"
    | "IDEMPOTENT"
    | "STALE_VERSION"
    | "VERSION_CONFLICT"
    | "INVALID_VERSION"
    | "PRODUCT_MISMATCH";
};

export type ShopCatalogShadowItem = {
  /** Stable product or product+variant identity supplied by each reader adapter. */
  key: string;
  /** Hash of the projected response fields whose equality matters to the storefront. */
  payloadHash?: string | null;
};

export type ShopCatalogShadowFacetValue = {
  key: string;
  count: number;
};

export type ShopCatalogShadowResult = {
  catalogVersion: string;
  totalItems: number;
  items: readonly ShopCatalogShadowItem[];
  facets?: Partial<
    Record<ShopCatalogProjectionFilterDimension, readonly ShopCatalogShadowFacetValue[]>
  >;
};

export type ShopCatalogShadowResultParity = {
  version: typeof SHOP_CATALOG_SHADOW_PARITY_VERSION;
  parity: boolean;
  coverageComplete: boolean;
  coverageIssues: readonly string[];
  catalogVersionMatch: boolean;
  totalItemsMatch: boolean;
  orderedItemsMatch: boolean;
  itemPayloadsMatch: boolean;
  facetsMatch: boolean;
  legacyFingerprint: string;
  projectionFingerprint: string;
  legacyItemCount: number;
  projectionItemCount: number;
  missingItemCount: number;
  unexpectedItemCount: number;
  changedItemCount: number;
  orderMismatchCount: number;
  facetMismatchCount: number;
  missingItems: readonly string[];
  unexpectedItems: readonly string[];
  changedItems: readonly string[];
  orderMismatches: readonly {
    rank: number;
    legacyKey: string | null;
    projectionKey: string | null;
  }[];
  facetMismatches: readonly {
    dimension: ShopCatalogProjectionFilterDimension;
    key: string;
    legacyCount: number | null;
    projectionCount: number | null;
  }[];
  samplesTruncated: boolean;
};

type RecordWithKey = Readonly<Record<string, unknown>>;

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { $number: String(value) };
    if (Object.is(value, -0)) return { $number: "-0" };
    return value;
  }
  if (typeof value === "bigint") return { $bigint: value.toString() };
  if (typeof value === "undefined") return { $undefined: true };
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  throw new TypeError(`Unsupported shadow parity value: ${typeof value}`);
}

function hashValue(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function targetKey(value: { variantId: string | null }) {
  return value.variantId ?? "$product";
}

function constraintValueKey(value: ShopCatalogProjectionBuild["compatibilityConstraints"][number]) {
  return `${targetKey(value)}\u0000${value.clauseId}\u0000${value.dimension}\u0000${value.valueOrdinal}`;
}

function bounded(values: readonly string[], limit: number) {
  return [...values].sort((left, right) => left.localeCompare(right, "en")).slice(0, limit);
}

function compareRecordSection<T extends RecordWithKey>(
  expected: readonly T[],
  actual: readonly T[],
  keyOf: (value: T) => string,
  sampleLimit: number
): ShopCatalogProjectionSectionParity {
  const expectedMap = new Map<string, string>();
  const actualMap = new Map<string, string>();
  const duplicateExpectedKeys = new Set<string>();
  const duplicateActualKeys = new Set<string>();
  for (const value of expected) {
    const key = keyOf(value);
    if (expectedMap.has(key)) duplicateExpectedKeys.add(key);
    expectedMap.set(key, hashValue(value));
  }
  for (const value of actual) {
    const key = keyOf(value);
    if (actualMap.has(key)) duplicateActualKeys.add(key);
    actualMap.set(key, hashValue(value));
  }

  const missing = [...expectedMap.keys()].filter((key) => !actualMap.has(key));
  const unexpected = [...actualMap.keys()].filter((key) => !expectedMap.has(key));
  const changed = [...expectedMap.keys()].filter(
    (key) => actualMap.has(key) && actualMap.get(key) !== expectedMap.get(key)
  );
  const differenceCount =
    missing.length +
    unexpected.length +
    changed.length +
    duplicateExpectedKeys.size +
    duplicateActualKeys.size;

  return {
    matches: differenceCount === 0 && expected.length === actual.length,
    expectedCount: expected.length,
    actualCount: actual.length,
    missingCount: missing.length,
    unexpectedCount: unexpected.length,
    changedCount: changed.length,
    duplicateExpectedKeys: bounded([...duplicateExpectedKeys], sampleLimit),
    duplicateActualKeys: bounded([...duplicateActualKeys], sampleLimit),
    missingKeys: bounded(missing, sampleLimit),
    unexpectedKeys: bounded(unexpected, sampleLimit),
    changedKeys: bounded(changed, sampleLimit),
    samplesTruncated: differenceCount > sampleLimit,
  };
}

export function compareShopCatalogProjectionBuilds(
  expected: ShopCatalogProjectionBuild,
  actual: ShopCatalogProjectionBuild,
  sampleLimit: number = SHOP_CATALOG_SHADOW_PARITY_LIMITS.differenceSamples
): ShopCatalogProjectionParityReport {
  const normalizedSampleLimit = Math.max(
    1,
    Math.min(SHOP_CATALOG_SHADOW_PARITY_LIMITS.differenceSamples, Math.floor(sampleLimit))
  );
  const sections = {
    projections: compareRecordSection(
      expected.projections,
      actual.projections,
      (value) => value.locale,
      normalizedSampleLimit
    ),
    skuRecords: compareRecordSection(
      expected.skuRecords,
      actual.skuRecords,
      (value) => `${targetKey(value)}\u0000${value.normalizedSku}`,
      normalizedSampleLimit
    ),
    compatibilityPolicies: compareRecordSection(
      expected.compatibilityPolicies,
      actual.compatibilityPolicies,
      targetKey,
      normalizedSampleLimit
    ),
    compatibilityClauses: compareRecordSection(
      expected.compatibilityClauses,
      actual.compatibilityClauses,
      (value) => `${targetKey(value)}\u0000${value.clauseId}`,
      normalizedSampleLimit
    ),
    compatibilityConstraints: compareRecordSection(
      expected.compatibilityConstraints,
      actual.compatibilityConstraints,
      constraintValueKey,
      normalizedSampleLimit
    ),
  } satisfies Record<ShopCatalogProjectionSectionName, ShopCatalogProjectionSectionParity>;
  const projectedFieldsMatch = Object.values(sections).every((section) => section.matches);
  const productIdentityMatch = expected.productId === actual.productId;
  const sourceVersionMatch = expected.sourceVersion === actual.sourceVersion;
  const catalogVersionMatch = expected.catalogVersion === actual.catalogVersion;
  const projectionVersionMatch = expected.projectionVersion === actual.projectionVersion;
  const sourceContentHashMatch = expected.sourceContentHash === actual.sourceContentHash;
  const canonicalRelationHashMatch =
    expected.canonicalRelationHash === actual.canonicalRelationHash;
  const canonicalRelationCountsMatch =
    hashValue(expected.canonicalRelationCounts) === hashValue(actual.canonicalRelationCounts);
  const canonicalLossLedgerReferenceMatch =
    sourceContentHashMatch && canonicalRelationHashMatch && canonicalRelationCountsMatch;
  const buildContentHashMatch = expected.contentHash === actual.contentHash;
  const parity =
    productIdentityMatch &&
    sourceVersionMatch &&
    catalogVersionMatch &&
    projectionVersionMatch &&
    projectedFieldsMatch &&
    canonicalLossLedgerReferenceMatch &&
    buildContentHashMatch;

  return Object.freeze({
    version: SHOP_CATALOG_SHADOW_PARITY_VERSION,
    parity,
    projectionContract: "COMPACT_WITH_CANONICAL_LOSS_LEDGER_REFERENCE",
    canonicalDataEmbedded: false,
    productIdentityMatch,
    sourceVersionMatch,
    catalogVersionMatch,
    projectionVersionMatch,
    projectedFieldsMatch,
    canonicalLossLedgerReferenceMatch,
    sourceContentHashMatch,
    canonicalRelationHashMatch,
    canonicalRelationCountsMatch,
    buildContentHashMatch,
    expectedBuildHash: expected.contentHash,
    actualBuildHash: actual.contentHash,
    sections: Object.freeze(sections),
  });
}

/** Rebuilds the expected compact record and compares it to a shadow result. */
export function compareShopCatalogProjectionToSource(
  source: ShopCatalogProjectionSource,
  actual: ShopCatalogProjectionBuild,
  sampleLimit?: number
) {
  return compareShopCatalogProjectionBuilds(
    buildShopCatalogProjection(source),
    actual,
    sampleLimit
  );
}

/** Pure stale-event guard for a future persistence adapter. */
export function decideShopCatalogProjectionReplacement(
  current: ShopCatalogProjectionBuild | null,
  incoming: ShopCatalogProjectionBuild
): ShopCatalogProjectionReplacementDecision {
  if (!/^\d+$/.test(incoming.projectionVersion) || !/^\d+$/.test(incoming.catalogVersion)) {
    return Object.freeze({ apply: false, reason: "INVALID_VERSION" });
  }
  if (incoming.projectionVersion !== incoming.catalogVersion) {
    return Object.freeze({ apply: false, reason: "INVALID_VERSION" });
  }
  if (!current) return Object.freeze({ apply: true, reason: "INSERT" });
  if (current.productId !== incoming.productId) {
    return Object.freeze({ apply: false, reason: "PRODUCT_MISMATCH" });
  }
  if (!/^\d+$/.test(current.projectionVersion) || !/^\d+$/.test(current.catalogVersion)) {
    return Object.freeze({ apply: false, reason: "INVALID_VERSION" });
  }
  if (current.projectionVersion !== current.catalogVersion) {
    return Object.freeze({ apply: false, reason: "INVALID_VERSION" });
  }
  const currentVersion = BigInt(current.projectionVersion);
  const incomingVersion = BigInt(incoming.projectionVersion);
  if (incomingVersion < currentVersion) {
    return Object.freeze({ apply: false, reason: "STALE_VERSION" });
  }
  if (incomingVersion > currentVersion) {
    return Object.freeze({ apply: true, reason: "NEWER_VERSION" });
  }
  if (incoming.contentHash === current.contentHash) {
    return Object.freeze({ apply: false, reason: "IDEMPOTENT" });
  }
  return Object.freeze({ apply: false, reason: "VERSION_CONFLICT" });
}

function normalizeShadowResult(result: ShopCatalogShadowResult, label: string) {
  const issues: string[] = [];
  if (!/^\d+$/.test(result.catalogVersion)) issues.push(`${label}:catalogVersion_invalid`);
  if (!Number.isSafeInteger(result.totalItems) || result.totalItems < 0) {
    issues.push(`${label}:totalItems_invalid`);
  }
  if (result.items.length > SHOP_CATALOG_SHADOW_PARITY_LIMITS.comparedItems) {
    issues.push(`${label}:items_exceed_${SHOP_CATALOG_SHADOW_PARITY_LIMITS.comparedItems}`);
  }
  const items = result.items
    .slice(0, SHOP_CATALOG_SHADOW_PARITY_LIMITS.comparedItems)
    .map((item, index) => {
      if (!item.key.trim()) issues.push(`${label}:item_${index}_key_invalid`);
      return { key: item.key, payloadHash: item.payloadHash ?? null };
    });
  const duplicateItemKeys = new Set<string>();
  const seenItems = new Set<string>();
  for (const item of items) {
    if (seenItems.has(item.key)) duplicateItemKeys.add(item.key);
    seenItems.add(item.key);
  }
  if (duplicateItemKeys.size) issues.push(`${label}:duplicate_item_keys`);

  const facets: Array<{
    dimension: ShopCatalogProjectionFilterDimension;
    key: string;
    count: number;
  }> = [];
  for (const dimension of SHOP_CATALOG_PROJECTION_FILTER_DIMENSIONS) {
    for (const [index, value] of (result.facets?.[dimension] ?? []).entries()) {
      if (!value.key.trim()) issues.push(`${label}:${dimension}_${index}_key_invalid`);
      if (!Number.isSafeInteger(value.count) || value.count < 0) {
        issues.push(`${label}:${dimension}_${index}_count_invalid`);
      }
      facets.push({ dimension, key: value.key, count: value.count });
    }
  }
  if (facets.length > SHOP_CATALOG_SHADOW_PARITY_LIMITS.facetValues) {
    issues.push(`${label}:facets_exceed_${SHOP_CATALOG_SHADOW_PARITY_LIMITS.facetValues}`);
  }
  const boundedFacets = facets
    .sort(
      (left, right) =>
        left.dimension.localeCompare(right.dimension, "en") ||
        left.key.localeCompare(right.key, "en")
    )
    .slice(0, SHOP_CATALOG_SHADOW_PARITY_LIMITS.facetValues);
  const facetKeys = new Set<string>();
  for (const facet of boundedFacets) {
    const key = `${facet.dimension}\u0000${facet.key}`;
    if (facetKeys.has(key)) issues.push(`${label}:duplicate_facet_keys`);
    facetKeys.add(key);
  }

  return {
    catalogVersion: result.catalogVersion,
    totalItems: result.totalItems,
    items,
    facets: boundedFacets,
    issues: [...new Set(issues)].sort((left, right) => left.localeCompare(right, "en")),
  };
}

export function compareShopCatalogShadowResults(
  legacy: ShopCatalogShadowResult,
  projection: ShopCatalogShadowResult,
  sampleLimit: number = SHOP_CATALOG_SHADOW_PARITY_LIMITS.differenceSamples
): ShopCatalogShadowResultParity {
  const normalizedSampleLimit = Math.max(
    1,
    Math.min(SHOP_CATALOG_SHADOW_PARITY_LIMITS.differenceSamples, Math.floor(sampleLimit))
  );
  const legacyResult = normalizeShadowResult(legacy, "legacy");
  const projectionResult = normalizeShadowResult(projection, "projection");
  const coverageIssues = [...legacyResult.issues, ...projectionResult.issues].sort((left, right) =>
    left.localeCompare(right, "en")
  );
  const coverageComplete = coverageIssues.length === 0;
  const legacyByKey = new Map(legacyResult.items.map((item) => [item.key, item]));
  const projectionByKey = new Map(projectionResult.items.map((item) => [item.key, item]));
  const missingItems = [...legacyByKey.keys()].filter((key) => !projectionByKey.has(key));
  const unexpectedItems = [...projectionByKey.keys()].filter((key) => !legacyByKey.has(key));
  const changedItems = [...legacyByKey.keys()].filter((key) => {
    const right = projectionByKey.get(key);
    return right && right.payloadHash !== legacyByKey.get(key)?.payloadHash;
  });
  const maxRank = Math.max(legacyResult.items.length, projectionResult.items.length);
  const orderMismatches = Array.from({ length: maxRank }, (_, rank) => ({
    rank,
    legacyKey: legacyResult.items[rank]?.key ?? null,
    projectionKey: projectionResult.items[rank]?.key ?? null,
  })).filter((entry) => entry.legacyKey !== entry.projectionKey);

  const legacyFacets = new Map(
    legacyResult.facets.map((value) => [`${value.dimension}\u0000${value.key}`, value])
  );
  const projectionFacets = new Map(
    projectionResult.facets.map((value) => [`${value.dimension}\u0000${value.key}`, value])
  );
  const facetKeys = new Set([...legacyFacets.keys(), ...projectionFacets.keys()]);
  const facetMismatches = [...facetKeys]
    .sort((left, right) => left.localeCompare(right, "en"))
    .flatMap((key) => {
      const left = legacyFacets.get(key);
      const right = projectionFacets.get(key);
      if (left?.count === right?.count) return [];
      const [dimension, facetKey] = key.split("\u0000") as [
        ShopCatalogProjectionFilterDimension,
        string,
      ];
      return [
        {
          dimension,
          key: facetKey,
          legacyCount: left?.count ?? null,
          projectionCount: right?.count ?? null,
        },
      ];
    });

  const catalogVersionMatch = legacyResult.catalogVersion === projectionResult.catalogVersion;
  const totalItemsMatch = legacyResult.totalItems === projectionResult.totalItems;
  const orderedItemsMatch = orderMismatches.length === 0;
  const itemPayloadsMatch = changedItems.length === 0;
  const facetsMatch = facetMismatches.length === 0;
  const parity =
    coverageComplete &&
    catalogVersionMatch &&
    totalItemsMatch &&
    orderedItemsMatch &&
    itemPayloadsMatch &&
    facetsMatch;
  const differenceCount =
    missingItems.length +
    unexpectedItems.length +
    changedItems.length +
    orderMismatches.length +
    facetMismatches.length;

  return Object.freeze({
    version: SHOP_CATALOG_SHADOW_PARITY_VERSION,
    parity,
    coverageComplete,
    coverageIssues: Object.freeze(coverageIssues),
    catalogVersionMatch,
    totalItemsMatch,
    orderedItemsMatch,
    itemPayloadsMatch,
    facetsMatch,
    legacyFingerprint: hashValue(legacyResult),
    projectionFingerprint: hashValue(projectionResult),
    legacyItemCount: legacyResult.items.length,
    projectionItemCount: projectionResult.items.length,
    missingItemCount: missingItems.length,
    unexpectedItemCount: unexpectedItems.length,
    changedItemCount: changedItems.length,
    orderMismatchCount: orderMismatches.length,
    facetMismatchCount: facetMismatches.length,
    missingItems: Object.freeze(bounded(missingItems, normalizedSampleLimit)),
    unexpectedItems: Object.freeze(bounded(unexpectedItems, normalizedSampleLimit)),
    changedItems: Object.freeze(bounded(changedItems, normalizedSampleLimit)),
    orderMismatches: Object.freeze(orderMismatches.slice(0, normalizedSampleLimit)),
    facetMismatches: Object.freeze(facetMismatches.slice(0, normalizedSampleLimit)),
    samplesTruncated: differenceCount > normalizedSampleLimit,
  });
}
