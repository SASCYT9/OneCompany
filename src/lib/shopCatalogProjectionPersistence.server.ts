import "server-only";

import {
  Prisma,
  ShopCatalogCompatibilityDimension,
  type ShopCatalogProjection,
} from "@prisma/client";

import { prisma } from "./prisma";
import {
  buildShopCatalogProjectionBatch,
  SHOP_CATALOG_PROJECTION_LIMITS,
  type ShopCatalogProjectionBatch,
  type ShopCatalogProjectionBuild,
  type ShopCatalogProjectionSource,
} from "./shopCatalogProjection.server";

export type ShopCatalogProjectionPersistenceDecision =
  | "INSERT"
  | "NEWER_VERSION"
  | "IDEMPOTENT"
  | "STALE_VERSION"
  | "VERSION_CONFLICT"
  | "INCONSISTENT_CURRENT_STATE";

export type ShopCatalogProjectionCurrentRow = Pick<
  ShopCatalogProjection,
  "locale" | "projectionVersion" | "contentHash"
>;

export type ShopCatalogProjectionPersistencePlan = {
  apply: boolean;
  decision: ShopCatalogProjectionPersistenceDecision;
  productId: string;
  projectionVersion: bigint;
  projectionRows: readonly Record<string, unknown>[];
  skuRows: readonly Record<string, unknown>[];
  policyRows: readonly Record<string, unknown>[];
  clauseRows: readonly Record<string, unknown>[];
  constraintRows: readonly Record<string, unknown>[];
};

export type ShopCatalogProjectionPersistResult = {
  productId: string;
  projectionVersion: string;
  decision: ShopCatalogProjectionPersistenceDecision;
  applied: boolean;
  rowCount: number;
};

type ShopCatalogBrandFacetProjection = {
  locale: string;
  scopeKey: string;
  statusKey: string;
  isPublished: boolean;
  brandKey: string;
  brandLabel: string;
};

export type ShopCatalogBrandFacetDelta = {
  locale: string;
  dimension: "BRAND" | "MAKE";
  prefixKey: string;
  valueKey: string;
  valueLabel: string;
  delta: number;
};

export type ShopCatalogMakeFacetValue = { key: string; label: string };

export type ShopCatalogProjectionRebuildSource = {
  loadPage(input: {
    afterProductId: string | null;
    limit: number;
  }): Promise<readonly ShopCatalogProjectionSource[]>;
};

export type ShopCatalogProjectionRebuildPageResult = {
  batch: ShopCatalogProjectionBatch;
  appliedProducts: number;
  skippedProducts: number;
  nextCursor: string | null;
  results: readonly ShopCatalogProjectionPersistResult[];
};

function targetKey(productId: string, variantId: string | null) {
  return variantId ? `variant:${variantId}` : `product:${productId}`;
}

function toBigInt(value: string, field: string) {
  if (!/^\d+$/.test(value)) throw new TypeError(`${field} must be an unsigned decimal integer`);
  return BigInt(value);
}

const PRISMA_COMPATIBILITY_DIMENSION = {
  scope: ShopCatalogCompatibilityDimension.SCOPE,
  make: ShopCatalogCompatibilityDimension.MAKE,
  model: ShopCatalogCompatibilityDimension.MODEL,
  generation: ShopCatalogCompatibilityDimension.GENERATION,
  chassis: ShopCatalogCompatibilityDimension.CHASSIS,
  year: ShopCatalogCompatibilityDimension.YEAR,
  engine: ShopCatalogCompatibilityDimension.ENGINE,
  fuel: ShopCatalogCompatibilityDimension.FUEL,
  bodyStyle: ShopCatalogCompatibilityDimension.BODY_STYLE,
  drivetrain: ShopCatalogCompatibilityDimension.DRIVETRAIN,
  transmission: ShopCatalogCompatibilityDimension.TRANSMISSION,
  market: ShopCatalogCompatibilityDimension.MARKET,
  opfGpf: ShopCatalogCompatibilityDimension.OPF_GPF,
} as const;

function toPrismaCompatibilityDimension(dimension: keyof typeof PRISMA_COMPATIBILITY_DIMENSION) {
  return PRISMA_COMPATIBILITY_DIMENSION[dimension];
}

function currentDecision(
  currentRows: readonly ShopCatalogProjectionCurrentRow[],
  incoming: ShopCatalogProjectionBuild
): ShopCatalogProjectionPersistenceDecision {
  if (currentRows.length === 0) return "INSERT";
  const versions = new Set(currentRows.map((row) => row.projectionVersion.toString()));
  if (versions.size !== 1) return "INCONSISTENT_CURRENT_STATE";
  const [currentVersionText] = versions;
  const currentVersion = BigInt(currentVersionText);
  const incomingVersion = toBigInt(incoming.projectionVersion, "projectionVersion");
  if (incomingVersion < currentVersion) return "STALE_VERSION";
  if (incomingVersion > currentVersion) return "NEWER_VERSION";

  const expectedHashes = new Map(incoming.projections.map((row) => [row.locale, row.contentHash]));
  const hashesMatch =
    currentRows.length === expectedHashes.size &&
    currentRows.every((row) => expectedHashes.get(row.locale as "ua" | "en") === row.contentHash);
  return hashesMatch ? "IDEMPOTENT" : "VERSION_CONFLICT";
}

function brandFacetBuckets(row: ShopCatalogBrandFacetProjection) {
  if (!row.isPublished || row.statusKey !== "ACTIVE" || !row.brandKey) return [];
  return ["", `scope:${row.scopeKey}`].map((prefixKey) => ({
    locale: row.locale,
    dimension: "BRAND" as const,
    prefixKey,
    valueKey: row.brandKey,
    valueLabel: row.brandLabel,
  }));
}

/** Pure delta plan used by transactional projection writes and rebuilds. */
export function buildShopCatalogBrandFacetDeltas(
  current: readonly ShopCatalogBrandFacetProjection[],
  incoming: readonly ShopCatalogBrandFacetProjection[]
): readonly ShopCatalogBrandFacetDelta[] {
  const deltas = new Map<string, Omit<ShopCatalogBrandFacetDelta, "delta"> & { delta: number }>();
  const currentLabels = new Map<string, string>();
  const incomingLabels = new Map<string, string>();
  const apply = (row: ShopCatalogBrandFacetProjection, direction: -1 | 1) => {
    for (const bucket of brandFacetBuckets(row)) {
      const identity = JSON.stringify([
        bucket.locale,
        bucket.dimension,
        bucket.prefixKey,
        bucket.valueKey,
      ]);
      const previous = deltas.get(identity);
      (direction === -1 ? currentLabels : incomingLabels).set(identity, bucket.valueLabel);
      deltas.set(identity, {
        ...bucket,
        valueLabel:
          direction === 1 ? bucket.valueLabel : (previous?.valueLabel ?? bucket.valueLabel),
        delta: (previous?.delta ?? 0) + direction,
      });
    }
  };
  current.forEach((row) => apply(row, -1));
  incoming.forEach((row) => apply(row, 1));
  return Object.freeze(
    [...deltas.entries()]
      .filter(
        ([identity, row]) =>
          row.delta !== 0 || currentLabels.get(identity) !== incomingLabels.get(identity)
      )
      .map(([, row]) => row)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"))
      .map((row) => Object.freeze(row))
  );
}

export function buildShopCatalogMakeFacetDeltas(
  current: {
    projections: readonly ShopCatalogBrandFacetProjection[];
    makes: readonly ShopCatalogMakeFacetValue[];
  },
  incoming: {
    projections: readonly ShopCatalogBrandFacetProjection[];
    makes: readonly ShopCatalogMakeFacetValue[];
  }
): readonly ShopCatalogBrandFacetDelta[] {
  const rows = new Map<string, ShopCatalogBrandFacetDelta>();
  const currentLabels = new Map<string, string>();
  const incomingLabels = new Map<string, string>();
  const apply = (
    projections: readonly ShopCatalogBrandFacetProjection[],
    makes: readonly ShopCatalogMakeFacetValue[],
    direction: -1 | 1
  ) => {
    const uniqueMakes = new Map(
      makes
        .filter((make) => make.key.trim())
        .map((make) => [make.key.trim().toLowerCase(), make.label.trim() || make.key.trim()])
    );
    for (const projection of projections) {
      if (!projection.isPublished || projection.statusKey !== "ACTIVE" || !projection.brandKey) {
        continue;
      }
      const prefixes = [
        `brand:${projection.brandKey.toLowerCase()}`,
        `scope:${projection.scopeKey}|brand:${projection.brandKey.toLowerCase()}`,
      ];
      for (const [valueKey, valueLabel] of uniqueMakes) {
        for (const prefixKey of prefixes) {
          const identity = JSON.stringify([projection.locale, prefixKey, valueKey]);
          const previous = rows.get(identity);
          (direction === -1 ? currentLabels : incomingLabels).set(identity, valueLabel);
          rows.set(identity, {
            locale: projection.locale,
            dimension: "MAKE",
            prefixKey,
            valueKey,
            valueLabel: direction === 1 ? valueLabel : (previous?.valueLabel ?? valueLabel),
            delta: (previous?.delta ?? 0) + direction,
          });
        }
      }
    }
  };
  apply(current.projections, current.makes, -1);
  apply(incoming.projections, incoming.makes, 1);
  return Object.freeze(
    [...rows.entries()]
      .filter(
        ([identity, row]) =>
          row.delta !== 0 || currentLabels.get(identity) !== incomingLabels.get(identity)
      )
      .map(([, row]) => row)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"))
      .map((row) => Object.freeze(row))
  );
}

async function applyShopCatalogBrandFacetDeltas(
  tx: Prisma.TransactionClient,
  deltas: readonly ShopCatalogBrandFacetDelta[]
) {
  for (const row of deltas) {
    const { delta, ...bucket } = row;
    const where = {
      locale_dimension_prefixKey_valueKey: {
        locale: row.locale,
        dimension: row.dimension,
        prefixKey: row.prefixKey,
        valueKey: row.valueKey,
      },
    };
    if (delta === 0) {
      const updated = await tx.shopCatalogProjectionFacetCount.updateMany({
        where: where.locale_dimension_prefixKey_valueKey,
        data: { valueLabel: row.valueLabel },
      });
      if (updated.count !== 1) {
        throw new Error(
          `Catalog facet label drift for ${row.locale}/${row.prefixKey}/${row.valueKey}`
        );
      }
      continue;
    }
    if (delta > 0) {
      await tx.shopCatalogProjectionFacetCount.upsert({
        where,
        create: { ...bucket, productCount: delta },
        update: { productCount: { increment: delta }, valueLabel: row.valueLabel },
      });
      continue;
    }
    const updated = await tx.shopCatalogProjectionFacetCount.updateMany({
      where: { ...where.locale_dimension_prefixKey_valueKey, productCount: { gte: -delta } },
      data: { productCount: { increment: delta } },
    });
    if (updated.count !== 1) {
      throw new Error(
        `Catalog facet counter drift for ${row.locale}/${row.prefixKey}/${row.valueKey}`
      );
    }
    await tx.shopCatalogProjectionFacetCount.deleteMany({
      where: { ...where.locale_dimension_prefixKey_valueKey, productCount: 0 },
    });
  }
}

/**
 * Converts a pure build into deterministic database rows and decides whether
 * it can replace the current version. No query or mutation happens here.
 */
export function planShopCatalogProjectionPersistence(
  currentRows: readonly ShopCatalogProjectionCurrentRow[],
  incoming: ShopCatalogProjectionBuild
): ShopCatalogProjectionPersistencePlan {
  const decision = currentDecision(currentRows, incoming);
  const apply = decision === "INSERT" || decision === "NEWER_VERSION";
  const projectionVersion = toBigInt(incoming.projectionVersion, "projectionVersion");
  const projectionRows = incoming.projections.map((row) => ({
    productId: row.productId,
    locale: row.locale,
    schemaVersion: row.schemaVersion,
    sourceVersion: toBigInt(row.sourceVersion, "sourceVersion"),
    catalogVersion: toBigInt(row.catalogVersion, "catalogVersion"),
    projectionVersion: toBigInt(row.projectionVersion, "projectionVersion"),
    sourceUpdatedAt: row.sourceUpdatedAt ? new Date(row.sourceUpdatedAt) : null,
    sourceContentHash: row.sourceContentHash,
    canonicalRelationHash: row.canonicalRelationHash,
    compatibilityHash: row.compatibilityHash,
    slug: row.slug,
    scopeKey: row.scopeKey,
    statusKey: row.statusKey,
    stockKey: row.stockKey,
    isPublished: row.isPublished,
    stableRank: row.stableRank,
    normalizedSku: row.normalizedSku,
    brandId: row.brandId,
    brandKey: row.brandKey,
    brandLabel: row.brandLabel,
    categoryId: row.categoryId,
    categoryKey: row.categoryKey,
    categoryLabel: row.categoryLabel,
    productTypeKey: row.productTypeKey,
    productKindKey: row.productKindKey,
    categoryGroupKey: row.categoryGroupKey,
    title: row.title,
    cardCopy: row.cardCopy,
    searchText: row.searchText,
    primaryMediaAssetId: row.primaryMedia?.assetId ?? null,
    primaryMediaUrl: row.primaryMedia?.url ?? null,
    primaryMediaWidth: row.primaryMedia?.width ?? null,
    primaryMediaHeight: row.primaryMedia?.height ?? null,
    primaryMediaVersion: row.primaryMedia?.version ?? null,
    contentHash: row.contentHash,
  }));
  const skuRows = incoming.skuRecords.map((row) => ({
    skuKey: targetKey(row.productId, row.variantId),
    productId: row.productId,
    variantId: row.variantId,
    sourceVersion: toBigInt(row.sourceVersion, "sourceVersion"),
    sku: row.sku,
    normalizedSku: row.normalizedSku,
    isDefault: row.isDefault,
    stableRank: row.stableRank,
  }));
  const policyRows = incoming.compatibilityPolicies.map((row) => ({
    targetKey: targetKey(row.productId, row.variantId),
    productId: row.productId,
    variantId: row.variantId,
    parentProductId: row.parentProductId,
    parentVariantId: row.parentVariantId,
    mode: row.mode,
    sourceVersion: toBigInt(row.sourceVersion, "sourceVersion"),
    requiredDimensions: row.requiredDimensions.map(toPrismaCompatibilityDimension),
    dimensionDefaults: row.dimensionDefaults as Prisma.InputJsonValue,
    clauseCount: row.clauseCount,
  }));
  const clauseRows = incoming.compatibilityClauses.map((row) => ({
    targetKey: targetKey(row.productId, row.variantId),
    productId: row.productId,
    variantId: row.variantId,
    sourceVersion: toBigInt(row.sourceVersion, "sourceVersion"),
    clauseKey: row.clauseId,
    verification: row.verification,
    sourceRef: row.sourceRef,
  }));
  const constraintRows = incoming.compatibilityConstraints.map((row) => ({
    targetKey: targetKey(row.productId, row.variantId),
    productId: row.productId,
    variantId: row.variantId,
    sourceVersion: toBigInt(row.sourceVersion, "sourceVersion"),
    clauseKey: row.clauseId,
    dimension: toPrismaCompatibilityDimension(row.dimension),
    state: row.state,
    valueOrdinal: row.valueOrdinal,
    valueKind: row.value?.kind ?? null,
    textValue: row.value?.kind === "text" ? row.value.text : null,
    numberValue: row.value?.kind === "number" ? row.value.number : null,
    booleanValue: row.value?.kind === "boolean" ? row.value.boolean : null,
    yearFrom: row.value?.kind === "year_range" ? row.value.yearFrom : null,
    yearTo: row.value?.kind === "year_range" ? row.value.yearTo : null,
  }));

  return Object.freeze({
    apply,
    decision,
    productId: incoming.productId,
    projectionVersion,
    projectionRows: Object.freeze(projectionRows),
    skuRows: Object.freeze(skuRows),
    policyRows: Object.freeze(policyRows),
    clauseRows: Object.freeze(clauseRows),
    constraintRows: Object.freeze(constraintRows),
  });
}

async function persistInTransaction(
  tx: Prisma.TransactionClient,
  incoming: ShopCatalogProjectionBuild
): Promise<ShopCatalogProjectionPersistResult> {
  const lockedProducts = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "ShopProduct" WHERE "id" = ${incoming.productId} FOR UPDATE
  `;
  if (lockedProducts.length !== 1) {
    throw new Error(`Cannot project missing product ${incoming.productId}`);
  }
  const currentRows = await tx.shopCatalogProjection.findMany({
    where: { productId: incoming.productId },
    select: {
      locale: true,
      projectionVersion: true,
      contentHash: true,
      scopeKey: true,
      statusKey: true,
      isPublished: true,
      brandKey: true,
      brandLabel: true,
    },
  });
  const plan = planShopCatalogProjectionPersistence(currentRows, incoming);
  if (!plan.apply) {
    if (plan.decision === "IDEMPOTENT" || plan.decision === "STALE_VERSION") {
      return {
        productId: plan.productId,
        projectionVersion: plan.projectionVersion.toString(),
        decision: plan.decision,
        applied: false,
        rowCount: 0,
      };
    }
    throw new Error(
      `Projection ${plan.productId}@${plan.projectionVersion} rejected: ${plan.decision}`
    );
  }

  const currentMakeRows = await tx.shopCatalogProjectionConstraint.findMany({
    where: {
      productId: plan.productId,
      dimension: ShopCatalogCompatibilityDimension.MAKE,
      state: "EXACT",
      textValue: { not: null },
    },
    select: { textValue: true },
  });
  const storefrontClauseKeys = new Set(
    plan.clauseRows.map((row) => `${row.targetKey}\u0000${row.clauseKey}`)
  );
  const incomingMakeRows = plan.constraintRows
    .filter(
      (row) =>
        row.dimension === ShopCatalogCompatibilityDimension.MAKE &&
        row.state === "EXACT" &&
        typeof row.textValue === "string" &&
        storefrontClauseKeys.has(`${row.targetKey}\u0000${row.clauseKey}`)
    )
    .map((row) => ({ key: String(row.textValue).toLowerCase(), label: String(row.textValue) }));

  await tx.shopCatalogProjectionPolicy.deleteMany({ where: { productId: plan.productId } });
  await tx.shopCatalogProjectionSku.deleteMany({ where: { productId: plan.productId } });
  const incomingFacetProjections =
    plan.projectionRows as unknown as ShopCatalogBrandFacetProjection[];
  await applyShopCatalogBrandFacetDeltas(tx, [
    ...buildShopCatalogBrandFacetDeltas(currentRows, incomingFacetProjections),
    ...buildShopCatalogMakeFacetDeltas(
      {
        projections: currentRows,
        makes: currentMakeRows.flatMap((row) =>
          row.textValue ? [{ key: row.textValue.toLowerCase(), label: row.textValue }] : []
        ),
      },
      { projections: incomingFacetProjections, makes: incomingMakeRows }
    ),
  ]);
  for (const row of plan.projectionRows) {
    const data = row as Prisma.ShopCatalogProjectionUncheckedCreateInput;
    await tx.shopCatalogProjection.upsert({
      where: { productId_locale: { productId: plan.productId, locale: String(row.locale) } },
      create: data,
      update: data,
    });
  }
  if (plan.skuRows.length) {
    await tx.shopCatalogProjectionSku.createMany({
      data: plan.skuRows as Prisma.ShopCatalogProjectionSkuCreateManyInput[],
    });
  }
  if (plan.policyRows.length) {
    await tx.shopCatalogProjectionPolicy.createMany({
      data: plan.policyRows as Prisma.ShopCatalogProjectionPolicyCreateManyInput[],
    });
  }
  if (plan.clauseRows.length) {
    await tx.shopCatalogProjectionClause.createMany({
      data: plan.clauseRows as Prisma.ShopCatalogProjectionClauseCreateManyInput[],
    });
  }
  if (plan.constraintRows.length) {
    await tx.shopCatalogProjectionConstraint.createMany({
      data: plan.constraintRows as Prisma.ShopCatalogProjectionConstraintCreateManyInput[],
    });
  }
  const rowCount =
    plan.projectionRows.length +
    plan.skuRows.length +
    plan.policyRows.length +
    plan.clauseRows.length +
    plan.constraintRows.length;
  return {
    productId: plan.productId,
    projectionVersion: plan.projectionVersion.toString(),
    decision: plan.decision,
    applied: true,
    rowCount,
  };
}

export async function persistShopCatalogProjectionBuild(
  incoming: ShopCatalogProjectionBuild
): Promise<ShopCatalogProjectionPersistResult> {
  return prisma.$transaction((tx) => persistInTransaction(tx, incoming), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 30_000,
  });
}

/** Processes exactly one bounded keyset page so a caller can checkpoint after every page. */
export async function rebuildShopCatalogProjectionPage(input: {
  source: ShopCatalogProjectionRebuildSource;
  afterProductId?: string | null;
  limit?: number;
  persist?: (build: ShopCatalogProjectionBuild) => Promise<ShopCatalogProjectionPersistResult>;
}): Promise<ShopCatalogProjectionRebuildPageResult> {
  const limit = input.limit ?? SHOP_CATALOG_PROJECTION_LIMITS.batchSize;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > SHOP_CATALOG_PROJECTION_LIMITS.batchSize
  ) {
    throw new TypeError(`limit must be between 1 and ${SHOP_CATALOG_PROJECTION_LIMITS.batchSize}`);
  }
  const sources = await input.source.loadPage({
    afterProductId: input.afterProductId ?? null,
    limit,
  });
  if (sources.length > limit)
    throw new Error("Projection source returned more rows than requested");
  const batch = buildShopCatalogProjectionBatch(sources);
  const persist = input.persist ?? persistShopCatalogProjectionBuild;
  const results: ShopCatalogProjectionPersistResult[] = [];
  for (const product of batch.products) results.push(await persist(product));
  return Object.freeze({
    batch,
    appliedProducts: results.filter((result) => result.applied).length,
    skippedProducts: results.filter((result) => !result.applied).length,
    nextCursor: batch.nextCursor,
    results: Object.freeze(results),
  });
}
