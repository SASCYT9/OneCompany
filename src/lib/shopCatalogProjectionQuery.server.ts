import "server-only";

import {
  Prisma,
  ShopCatalogClauseVerification,
  ShopCatalogCompatibilityDimension,
  ShopCatalogCompatibilityMode,
  ShopCatalogConstraintState,
} from "@prisma/client";

import { prisma } from "./prisma";
import type { ShopCatalogShadowFlag } from "./shopCatalogShadowFlag.server";

export const SHOP_CATALOG_PROJECTION_QUERY_LIMITS = {
  defaultPageSize: 24,
  maxPageSize: 100,
  text: 256,
  facet: 320,
} as const;

export type ShopCatalogProjectionQueryInput = {
  locale: "ua" | "en";
  limit?: number;
  after?: { stableRank: string; productId: string } | null;
  text?: string | null;
  scope?: string | null;
  brand?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  year?: number | null;
  engine?: string | null;
  fuel?: string | null;
};

export type ShopCatalogProjectionQueryItem = {
  productId: string;
  locale: string;
  slug: string;
  title: string;
  cardCopy: string | null;
  brandKey: string;
  brandLabel: string;
  categoryKey: string | null;
  categoryLabel: string | null;
  stableRank: string;
  normalizedSku: string | null;
  primaryMediaUrl: string | null;
  minPriceEur: string | null;
  minPriceEurEurope: string | null;
  minPriceUsd: string | null;
  minPriceUah: string | null;
  contentHash: string;
  projectionVersion: string;
};

export type ShopCatalogProjectionQueryResult = {
  source: "catalog_v2_projection";
  items: readonly ShopCatalogProjectionQueryItem[];
  hasMore: boolean;
  nextCursor: { stableRank: string; productId: string } | null;
};

export type ShopCatalogProjectionShadowQueryResult =
  | { enabled: false; reason: ShopCatalogShadowFlag["reason"]; result: null }
  | {
      enabled: true;
      reason: ShopCatalogShadowFlag["reason"];
      result: ShopCatalogProjectionQueryResult;
    };

type VehicleDimension = "make" | "model" | "generation" | "engine" | "fuel";

const VEHICLE_DIMENSIONS: Readonly<Record<VehicleDimension, ShopCatalogCompatibilityDimension>> = {
  make: ShopCatalogCompatibilityDimension.MAKE,
  model: ShopCatalogCompatibilityDimension.MODEL,
  generation: ShopCatalogCompatibilityDimension.GENERATION,
  engine: ShopCatalogCompatibilityDimension.ENGINE,
  fuel: ShopCatalogCompatibilityDimension.FUEL,
};

function optionalBounded(value: string | null | undefined, field: string, max: number) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > max) throw new TypeError(`${field} exceeds ${max} characters`);
  return normalized;
}

export function normalizeShopCatalogProjectionQuery(
  input: ShopCatalogProjectionQueryInput
): Required<Pick<ShopCatalogProjectionQueryInput, "locale">> &
  Omit<ShopCatalogProjectionQueryInput, "locale"> & { limit: number } {
  const limit = input.limit ?? SHOP_CATALOG_PROJECTION_QUERY_LIMITS.defaultPageSize;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > SHOP_CATALOG_PROJECTION_QUERY_LIMITS.maxPageSize
  ) {
    throw new TypeError(
      `limit must be between 1 and ${SHOP_CATALOG_PROJECTION_QUERY_LIMITS.maxPageSize}`
    );
  }
  if (
    input.year != null &&
    (!Number.isSafeInteger(input.year) || input.year < 1886 || input.year > 2200)
  ) {
    throw new TypeError("year must be an integer between 1886 and 2200");
  }
  if (
    input.after &&
    (!input.after.productId.trim() || !/^-?\d+(?:\.\d+)?$/.test(input.after.stableRank))
  ) {
    throw new TypeError("after cursor is invalid");
  }
  return Object.freeze({
    locale: input.locale,
    limit,
    after: input.after ?? null,
    text: optionalBounded(input.text, "text", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.text),
    scope: optionalBounded(input.scope, "scope", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    brand: optionalBounded(input.brand, "brand", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    make: optionalBounded(input.make, "make", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    model: optionalBounded(input.model, "model", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    generation: optionalBounded(
      input.generation,
      "generation",
      SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet
    ),
    year: input.year ?? null,
    engine: optionalBounded(input.engine, "engine", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    fuel: optionalBounded(input.fuel, "fuel", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
  });
}

function textConstraint(
  dimension: ShopCatalogCompatibilityDimension,
  value: string
): Prisma.ShopCatalogProjectionConstraintWhereInput {
  return {
    dimension,
    OR: [
      {
        state: { in: [ShopCatalogConstraintState.ANY, ShopCatalogConstraintState.NOT_APPLICABLE] },
      },
      {
        state: ShopCatalogConstraintState.EXACT,
        textValue: { equals: value, mode: "insensitive" },
      },
    ],
  };
}

function yearConstraint(year: number): Prisma.ShopCatalogProjectionConstraintWhereInput {
  return {
    dimension: ShopCatalogCompatibilityDimension.YEAR,
    OR: [
      {
        state: { in: [ShopCatalogConstraintState.ANY, ShopCatalogConstraintState.NOT_APPLICABLE] },
      },
      {
        state: ShopCatalogConstraintState.EXACT,
        AND: [
          { OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] },
          { OR: [{ yearTo: null }, { yearTo: { gte: year } }] },
        ],
      },
    ],
  };
}

function escapeLike(value: string) {
  return value.replace(/([\\%_])/g, "\\$1");
}

function correlatedTextConstraintSql(dimension: ShopCatalogCompatibilityDimension, value: string) {
  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "ShopCatalogProjectionConstraint" compatibility_constraint
      WHERE compatibility_constraint."targetKey" = clause."targetKey"
        AND compatibility_constraint."clauseKey" = clause."clauseKey"
        AND compatibility_constraint."productId" = clause."productId"
        AND compatibility_constraint."sourceVersion" = clause."sourceVersion"
        AND compatibility_constraint."dimension" = ${dimension}::"ShopCatalogCompatibilityDimension"
        AND (
          compatibility_constraint."state" IN ('ANY', 'NOT_APPLICABLE')
          OR (
            compatibility_constraint."state" = 'EXACT'
            AND lower(compatibility_constraint."textValue") = lower(${value})
          )
        )
      OFFSET 0
    )`;
}

function correlatedYearConstraintSql(year: number) {
  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "ShopCatalogProjectionConstraint" compatibility_constraint
      WHERE compatibility_constraint."targetKey" = clause."targetKey"
        AND compatibility_constraint."clauseKey" = clause."clauseKey"
        AND compatibility_constraint."productId" = clause."productId"
        AND compatibility_constraint."sourceVersion" = clause."sourceVersion"
        AND compatibility_constraint."dimension" = 'YEAR'
        AND (
          compatibility_constraint."state" IN ('ANY', 'NOT_APPLICABLE')
          OR (
            compatibility_constraint."state" = 'EXACT'
            AND (compatibility_constraint."yearFrom" IS NULL OR compatibility_constraint."yearFrom" <= ${year})
            AND (compatibility_constraint."yearTo" IS NULL OR compatibility_constraint."yearTo" >= ${year})
          )
        )
      OFFSET 0
    )`;
}

export function buildShopCatalogProjectionVehicleQuerySql(
  raw: ShopCatalogProjectionQueryInput
): Prisma.Sql | null {
  const input = normalizeShopCatalogProjectionQuery(raw);
  const vehicleConstraints: Prisma.Sql[] = [];
  for (const field of Object.keys(VEHICLE_DIMENSIONS) as VehicleDimension[]) {
    const value = input[field];
    if (value) {
      vehicleConstraints.push(correlatedTextConstraintSql(VEHICLE_DIMENSIONS[field], value));
    }
  }
  if (input.year != null) vehicleConstraints.push(correlatedYearConstraintSql(input.year));
  if (vehicleConstraints.length === 0) return null;

  const projectionConditions: Prisma.Sql[] = [
    Prisma.sql`projection."locale" = ${input.locale}`,
    Prisma.sql`projection."isPublished" = true`,
    Prisma.sql`projection."statusKey" = 'ACTIVE'`,
  ];
  if (input.scope) projectionConditions.push(Prisma.sql`projection."scopeKey" = ${input.scope}`);
  if (input.brand) {
    projectionConditions.push(
      Prisma.sql`(lower(projection."brandKey") = lower(${input.brand}) OR lower(projection."brandLabel") = lower(${input.brand}))`
    );
  }
  if (input.text) {
    projectionConditions.push(
      Prisma.sql`projection."searchText" ILIKE ${`%${escapeLike(input.text)}%`} ESCAPE '\\'`
    );
  }
  if (input.after) {
    projectionConditions.push(
      Prisma.sql`(projection."stableRank" > ${input.after.stableRank}::numeric OR (projection."stableRank" = ${input.after.stableRank}::numeric AND projection."productId" > ${input.after.productId}))`
    );
  }

  projectionConditions.push(Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "ShopCatalogProjectionPolicy" policy
      JOIN "ShopCatalogProjectionClause" clause
        ON clause."targetKey" = policy."targetKey"
       AND clause."productId" = policy."productId"
       AND clause."sourceVersion" = policy."sourceVersion"
      WHERE policy."productId" = projection."productId"
        AND policy."mode" IN ('VEHICLE_SPECIFIC', 'UNIVERSAL')
        AND clause."verification" = 'VERIFIED'
        AND ${Prisma.join(vehicleConstraints, " AND ")}
      OFFSET 0
    )`);

  return Prisma.sql`
    SELECT
      projection."productId",
      projection."locale",
      projection."slug",
      projection."title",
      projection."cardCopy",
      projection."brandKey",
      projection."brandLabel",
      projection."categoryKey",
      projection."categoryLabel",
      projection."stableRank",
      projection."normalizedSku",
      projection."primaryMediaUrl",
      projection."minPriceEur",
      projection."minPriceEurEurope",
      projection."minPriceUsd",
      projection."minPriceUah",
      projection."contentHash",
      projection."projectionVersion"
    FROM "ShopCatalogProjection" projection
    WHERE ${Prisma.join(projectionConditions, " AND ")}
    ORDER BY projection."stableRank" ASC, projection."productId" ASC
    LIMIT ${input.limit + 1}`;
}

/** Builds one correlated-clause filter; selected vehicle fields cannot cross-match different clauses. */
export function buildShopCatalogProjectionWhere(
  raw: ShopCatalogProjectionQueryInput
): Prisma.ShopCatalogProjectionWhereInput {
  const input = normalizeShopCatalogProjectionQuery(raw);
  const constraints: Prisma.ShopCatalogProjectionConstraintWhereInput[] = [];
  const and: Prisma.ShopCatalogProjectionWhereInput[] = [];
  for (const field of Object.keys(VEHICLE_DIMENSIONS) as VehicleDimension[]) {
    const value = input[field];
    if (value) constraints.push(textConstraint(VEHICLE_DIMENSIONS[field], value));
  }
  if (input.year != null) constraints.push(yearConstraint(input.year));
  if (input.brand) {
    and.push({
      OR: [
        { brandKey: { equals: input.brand, mode: "insensitive" } },
        { brandLabel: { equals: input.brand, mode: "insensitive" } },
      ],
    });
  }
  if (input.after) {
    and.push({
      OR: [
        { stableRank: { gt: input.after.stableRank } },
        { stableRank: input.after.stableRank, productId: { gt: input.after.productId } },
      ],
    });
  }

  return {
    locale: input.locale,
    isPublished: true,
    statusKey: "ACTIVE",
    ...(input.scope ? { scopeKey: input.scope } : {}),
    ...(and.length ? { AND: and } : {}),
    ...(input.text
      ? {
          searchText: { contains: input.text, mode: "insensitive" },
        }
      : {}),
    ...(constraints.length
      ? {
          product: {
            catalogProjectionPolicies: {
              some: {
                mode: {
                  in: [
                    ShopCatalogCompatibilityMode.VEHICLE_SPECIFIC,
                    ShopCatalogCompatibilityMode.UNIVERSAL,
                  ],
                },
                clauses: {
                  some: {
                    verification: ShopCatalogClauseVerification.VERIFIED,
                    AND: constraints.map((constraint) => ({ constraints: { some: constraint } })),
                  },
                },
              },
            },
          },
        }
      : {}),
  };
}

export async function queryShopCatalogProjection(
  raw: ShopCatalogProjectionQueryInput
): Promise<ShopCatalogProjectionQueryResult> {
  const input = normalizeShopCatalogProjectionQuery(raw);
  const vehicleSql = buildShopCatalogProjectionVehicleQuerySql(input);
  const rows = vehicleSql
    ? await prisma.$queryRaw<
        Array<{
          productId: string;
          locale: string;
          slug: string;
          title: string;
          cardCopy: string | null;
          brandKey: string;
          brandLabel: string;
          categoryKey: string | null;
          categoryLabel: string | null;
          stableRank: Prisma.Decimal;
          normalizedSku: string | null;
          primaryMediaUrl: string | null;
          minPriceEur: Prisma.Decimal | null;
          minPriceEurEurope: Prisma.Decimal | null;
          minPriceUsd: Prisma.Decimal | null;
          minPriceUah: Prisma.Decimal | null;
          contentHash: string;
          projectionVersion: bigint;
        }>
      >(vehicleSql)
    : await prisma.shopCatalogProjection.findMany({
        where: buildShopCatalogProjectionWhere(input),
        orderBy: [{ stableRank: "asc" }, { productId: "asc" }],
        take: input.limit + 1,
        select: {
          productId: true,
          locale: true,
          slug: true,
          title: true,
          cardCopy: true,
          brandKey: true,
          brandLabel: true,
          categoryKey: true,
          categoryLabel: true,
          stableRank: true,
          normalizedSku: true,
          primaryMediaUrl: true,
          minPriceEur: true,
          minPriceEurEurope: true,
          minPriceUsd: true,
          minPriceUah: true,
          contentHash: true,
          projectionVersion: true,
        },
      });
  const hasMore = rows.length > input.limit;
  const visible = rows.slice(0, input.limit).map((row) => ({
    ...row,
    stableRank: row.stableRank.toString(),
    minPriceEur: row.minPriceEur?.toString() ?? null,
    minPriceEurEurope: row.minPriceEurEurope?.toString() ?? null,
    minPriceUsd: row.minPriceUsd?.toString() ?? null,
    minPriceUah: row.minPriceUah?.toString() ?? null,
    projectionVersion: row.projectionVersion.toString(),
  }));
  const last = visible.at(-1);
  return Object.freeze({
    source: "catalog_v2_projection",
    items: Object.freeze(visible),
    hasMore,
    nextCursor: last && hasMore ? { stableRank: last.stableRank, productId: last.productId } : null,
  });
}

export async function queryShopCatalogProjectionShadow(input: {
  flag: ShopCatalogShadowFlag;
  query: ShopCatalogProjectionQueryInput;
}): Promise<ShopCatalogProjectionShadowQueryResult> {
  if (!input.flag.enabled) {
    return Object.freeze({ enabled: false, reason: input.flag.reason, result: null });
  }
  return Object.freeze({
    enabled: true,
    reason: input.flag.reason,
    result: await queryShopCatalogProjection(input.query),
  });
}
