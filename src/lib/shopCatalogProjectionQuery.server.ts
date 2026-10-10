import { SHOP_SEARCH_QUERY_MAX_LENGTH } from "./shopSearch";
import {
  Prisma,
  ShopCatalogCompatibilityDimension,
  ShopCatalogCompatibilityMode,
  ShopCatalogConstraintState,
} from "@prisma/client";

import { prisma } from "./prisma";
import {
  buildShopCatalogEffectivePriceSql,
  type ShopCatalogEffectivePriceContext,
} from "./shopCatalogEffectivePrice.server";
import type { ShopCatalogShadowFlag } from "./shopCatalogShadowFlag.server";
import {
  canonicalizeVehicleModels,
  vehicleModelAliases,
  vehicleMakeAliases,
  vehicleModelKey,
} from "./shopVehicleTaxonomy";
import {
  vehicleChassisKey,
  vehicleChassisSelfAndAncestors,
  vehicleModelScope,
} from "./shopVehicleHierarchy";
import {
  isShopSearchBrandToken,
  normalizeShopSearchText,
  tokenizeShopSearchQuery,
} from "./shopSearch";
import { shopSearchTokenConditionSql } from "./shopSearchSql";
import {
  getShopStockCategoryLabel,
  resolveShopStockCategoryGroupId,
  SHOP_STOCK_CATEGORY_GROUPS,
} from "./shopStockTaxonomy";
import { isUrbanProductBrand, URBAN_PRODUCT_BRAND_ALIASES } from "./shopProductDisplayBrand";
import { isExactWheelForceSkuSearch } from "./wheelforceFamily";

export const SHOP_CATALOG_PROJECTION_QUERY_LIMITS = {
  defaultPageSize: 24,
  maxPageSize: 100,
  text: SHOP_SEARCH_QUERY_MAX_LENGTH,
  facet: 320,
} as const;

export type ShopCatalogProjectionQueryInput = {
  locale: "ua" | "en";
  limit?: number;
  after?: { stableRank: string; productId: string } | null;
  text?: string | null;
  scope?: string | null;
  /**
   * Partition to leave out when no strict scope is requested. The storefront
   * "Auto" tab is unpartitioned (many automotive rows carry no explicit auto
   * scope) but must not list motorcycle-only products.
   */
  excludeScope?: string | null;
  brand?: string | null;
  category?: string | null;
  make?: string | null;
  model?: string | null;
  modelAlternates?: readonly string[] | null;
  generation?: string | null;
  year?: number | null;
  engine?: string | null;
  fuel?: string | null;
  opfGpf?: string | null;
  productIds?: readonly string[] | null;
  excludeProductIds?: readonly string[] | null;
  /** Products that match the selected vehicle exactly; they sort ahead of the rest. */
  priorityProductIds?: readonly string[] | null;
  /**
   * Also match products filed on a broader label (`992` for a 992.1 request,
   * `911` for `911 Carrera`) and rank the exact ones first, in SQL.
   */
  vehicleLowerTier?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  priceCurrency?: "EUR" | "USD" | "UAH" | null;
  offset?: number;
  order?: "default" | "price_asc" | "price_desc" | "name_asc" | "brand_interleave";
  orderSeed?: string | null;
  useEuropePrice?: boolean;
  effectivePriceContext?: ShopCatalogEffectivePriceContext | null;
  /**
   * Whether every projection row already carries a taxonomy group in
   * `categoryGroupKey`. The async entry points detect this; pure SQL builders
   * default to true. While false, the category facet and filter keep reading
   * the admin category columns, so a deploy never has to wait for the rebuild.
   */
  categoryGroupsReady?: boolean | null;
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
  productTypeKey: string | null;
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

const CATEGORY_GROUPS_READY_TTL_MS = 60_000;
let categoryGroupsReadyCache: { value: Promise<boolean>; expiresAt: number } | null = null;

/**
 * Only published rows matter: unpublished products (drafts, archive, family
 * children) are never rebuilt by the backfill and are never listed, so they
 * must not hold the facet back.
 */
export function buildCategoryGroupsReadinessSql() {
  const groupIds = SHOP_STOCK_CATEGORY_GROUPS.map((group) => group.id);
  return Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM "ShopCatalogProjection" projection
      WHERE projection."isPublished" = true
        AND (projection."categoryGroupKey" IS NULL
             OR projection."categoryGroupKey" NOT IN (${Prisma.join(groupIds)}))
    ) AS "pending"
  `;
}

async function probeCategoryGroupsReady(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ pending: boolean }>>(
      buildCategoryGroupsReadinessSql()
    );
    return rows[0]?.pending === false;
  } catch {
    return false;
  }
}

/**
 * True once no projection row is left without a taxonomy group id. The probe
 * promise itself is cached, so the concurrent product/facet/summary reads of one
 * request share a single query per minute; failure keeps the legacy behavior.
 */
function categoryGroupsReady(): Promise<boolean> {
  const now = Date.now();
  if (categoryGroupsReadyCache && categoryGroupsReadyCache.expiresAt > now) {
    return categoryGroupsReadyCache.value;
  }
  const value = probeCategoryGroupsReady();
  categoryGroupsReadyCache = { value, expiresAt: now + CATEGORY_GROUPS_READY_TTL_MS };
  return value;
}

async function withCategoryGroupMode<T extends ShopCatalogProjectionQueryInput>(
  raw: T
): Promise<T> {
  if (raw.categoryGroupsReady != null) return raw;
  return { ...raw, categoryGroupsReady: await categoryGroupsReady() };
}

export async function countShopCatalogProjection(
  raw: ShopCatalogProjectionQueryInput
): Promise<number> {
  const input = normalizeShopCatalogProjectionQuery(await withCategoryGroupMode(raw));
  const conditions = projectionFacetBaseConditions(input, true);
  const vehicleCondition = selectedVehicleCondition(input);
  if (vehicleCondition) conditions.push(vehicleCondition);
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT count(*)::bigint AS "count"
    FROM "ShopCatalogProjection" projection
    WHERE ${Prisma.join(conditions, " AND ")}
  `);
  const count = Number(rows[0]?.count ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export const SHOP_CATALOG_PROJECTION_FACET_LIMIT = 100 as const;

/** One aggregate over the exact listing predicate, independent of pagination. */
export async function queryShopCatalogProjectionStockSummary(
  raw: ShopCatalogProjectionQueryInput,
  inStockProductIds: readonly string[]
): Promise<{
  totalItems: number;
  inStock: number;
  preOrder: number;
  price?: { min: number; max: number; currency: string };
}> {
  const input = normalizeShopCatalogProjectionQuery(await withCategoryGroupMode(raw));
  const price = input.effectivePriceContext ? projectionPriceSql(input) : Prisma.sql`NULL::numeric`;
  const conditions = projectionFacetBaseConditions(
    input,
    true,
    true,
    input.effectivePriceContext ? Prisma.sql`summary_price.amount` : undefined
  );
  const vehicleCondition = selectedVehicleCondition(input);
  if (vehicleCondition) conditions.push(vehicleCondition);
  const ids = [...new Set(inStockProductIds)];
  const inStock = ids.length
    ? Prisma.sql`projection."productId" IN (${Prisma.join(ids)})`
    : Prisma.sql`FALSE`;
  const rows = await prisma.$queryRaw<
    Array<{ totalItems: bigint; inStock: bigint; minPrice: number | null; maxPrice: number | null }>
  >(Prisma.sql`
    SELECT count(*)::bigint AS "totalItems",
           count(*) FILTER (WHERE ${inStock})::bigint AS "inStock",
           min(summary_price.amount)::float8 AS "minPrice",
           max(summary_price.amount)::float8 AS "maxPrice"
    FROM "ShopCatalogProjection" projection
    CROSS JOIN LATERAL (SELECT ${price} AS amount OFFSET 0) summary_price
    WHERE ${Prisma.join(conditions, " AND ")}
  `);
  const totalItems = Number(rows[0]?.totalItems ?? 0);
  const stockItems = Number(rows[0]?.inStock ?? 0);
  if (
    !Number.isSafeInteger(totalItems) ||
    !Number.isSafeInteger(stockItems) ||
    stockItems < 0 ||
    totalItems < stockItems
  ) {
    throw new TypeError("Invalid catalog stock aggregate");
  }
  return {
    totalItems,
    inStock: stockItems,
    preOrder: totalItems - stockItems,
    ...(input.effectivePriceContext
      ? {
          price: {
            min: Math.floor(rows[0]?.minPrice ?? 0),
            max: Math.ceil(rows[0]?.maxPrice ?? 0),
            currency: input.effectivePriceContext.currency,
          },
        }
      : {}),
  };
}

export type ShopCatalogProjectionFacetItem = {
  key: string;
  label: string;
  count: number;
  yearFrom: number | null;
  yearTo: number | null;
};

export type ShopCatalogProjectionFacetResult = {
  source: "catalog_v2_projection";
  facets: Readonly<
    Record<
      "brand" | "category" | "make" | "model" | "generation" | "year" | "engine" | "fuel",
      readonly ShopCatalogProjectionFacetItem[]
    >
  >;
};

export type ShopCatalogProjectionShadowQueryResult =
  | { enabled: false; reason: ShopCatalogShadowFlag["reason"]; result: null }
  | {
      enabled: true;
      reason: ShopCatalogShadowFlag["reason"];
      result: ShopCatalogProjectionQueryResult;
    };

type VehicleDimension = "make" | "model" | "generation" | "engine" | "fuel" | "opfGpf";

const VEHICLE_DIMENSIONS: Readonly<Record<VehicleDimension, ShopCatalogCompatibilityDimension>> = {
  make: ShopCatalogCompatibilityDimension.MAKE,
  model: ShopCatalogCompatibilityDimension.MODEL,
  generation: ShopCatalogCompatibilityDimension.GENERATION,
  engine: ShopCatalogCompatibilityDimension.ENGINE,
  fuel: ShopCatalogCompatibilityDimension.FUEL,
  opfGpf: ShopCatalogCompatibilityDimension.OPF_GPF,
};

function optionalBounded(value: string | null | undefined, field: string, max: number) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > max) throw new TypeError(`${field} exceeds ${max} characters`);
  return normalized;
}

function normalizeOpfGpf(value: string | null | undefined) {
  const normalized = optionalBounded(
    value,
    "opfGpf",
    SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet
  )?.toLowerCase();
  if (normalized == null) return null;
  if (normalized !== "with" && normalized !== "without") {
    throw new TypeError("opfGpf must be with or without");
  }
  return normalized;
}

export function normalizeShopCatalogProjectionQuery(
  input: ShopCatalogProjectionQueryInput
): Required<Pick<ShopCatalogProjectionQueryInput, "locale">> &
  Omit<ShopCatalogProjectionQueryInput, "locale"> & { limit: number } {
  const limit = input.limit ?? SHOP_CATALOG_PROJECTION_QUERY_LIMITS.defaultPageSize;
  const offset = input.offset ?? 0;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > SHOP_CATALOG_PROJECTION_QUERY_LIMITS.maxPageSize
  ) {
    throw new TypeError(
      `limit must be between 1 and ${SHOP_CATALOG_PROJECTION_QUERY_LIMITS.maxPageSize}`
    );
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new TypeError("offset must be between 0 and 1000000");
  }
  for (const [field, value] of [
    ["minPrice", input.minPrice],
    ["maxPrice", input.maxPrice],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      throw new TypeError(`${field} must be a non-negative number`);
    }
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
  if (input.after && (offset !== 0 || (input.order && input.order !== "default"))) {
    throw new TypeError("stable-rank cursor requires default order and no offset");
  }
  // Exact-first vehicle ordering is not a stable-rank order: page by offset.
  if (input.after && (input.priorityProductIds?.length || input.vehicleLowerTier)) {
    throw new TypeError("stable-rank cursor cannot follow exact-first vehicle ordering");
  }
  return Object.freeze({
    locale: input.locale,
    limit,
    after: input.after ?? null,
    text: optionalBounded(input.text, "text", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.text),
    scope: optionalBounded(input.scope, "scope", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    // A strict scope already selects exactly one partition.
    excludeScope: input.scope
      ? null
      : optionalBounded(
          input.excludeScope,
          "excludeScope",
          SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet
        ),
    brand: optionalBounded(input.brand, "brand", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    category: optionalBounded(
      input.category,
      "category",
      SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet
    ),
    make: optionalBounded(input.make, "make", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    model: optionalBounded(input.model, "model", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    modelAlternates: [
      ...new Set(
        (input.modelAlternates ?? [])
          .map((value) =>
            optionalBounded(value, "modelAlternates", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet)
          )
          .filter((value): value is string => Boolean(value))
      ),
    ],
    generation: optionalBounded(
      input.generation,
      "generation",
      SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet
    ),
    year: input.year ?? null,
    engine: optionalBounded(input.engine, "engine", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    fuel: optionalBounded(input.fuel, "fuel", SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet),
    opfGpf: normalizeOpfGpf(input.opfGpf),
    productIds: input.productIds ? [...new Set(input.productIds.filter(Boolean))] : null,
    excludeProductIds: input.excludeProductIds
      ? [...new Set(input.excludeProductIds.filter(Boolean))]
      : null,
    priorityProductIds: input.priorityProductIds?.length
      ? [...new Set(input.priorityProductIds.filter(Boolean))]
      : null,
    vehicleLowerTier: input.vehicleLowerTier === true,
    minPrice: input.minPrice ?? null,
    maxPrice: input.maxPrice ?? null,
    priceCurrency: input.priceCurrency ?? "USD",
    offset,
    order: input.order ?? "default",
    orderSeed: optionalBounded(
      input.orderSeed,
      "orderSeed",
      SHOP_CATALOG_PROJECTION_QUERY_LIMITS.facet
    ),
    useEuropePrice: input.useEuropePrice ?? false,
    effectivePriceContext: input.effectivePriceContext ?? null,
    categoryGroupsReady: input.categoryGroupsReady !== false,
  });
}

function projectionPriceSql(input: ReturnType<typeof normalizeShopCatalogProjectionQuery>) {
  if (input.effectivePriceContext)
    return buildShopCatalogEffectivePriceSql(input.effectivePriceContext);
  if (input.useEuropePrice) {
    return Prisma.sql`COALESCE(
      (SELECT COALESCE(
         NULLIF(COALESCE(canonical_product."priceEurEurope", canonical_variant."priceEurEurope"), 0),
         NULLIF(COALESCE(canonical_product."priceEur", canonical_variant."priceEur"), 0)
       )
       FROM "ShopProduct" canonical_product
       LEFT JOIN LATERAL (
         SELECT variant."priceEur", variant."priceEurEurope"
         FROM "ShopProductVariant" variant
         WHERE variant."productId" = canonical_product."id"
         ORDER BY variant."isDefault" DESC, variant."position" ASC
         LIMIT 1
       ) canonical_variant ON true
       WHERE canonical_product."id" = projection."productId"),
      NULLIF(projection."minPriceEurEurope", 0), NULLIF(projection."minPriceEur", 0)
    )`;
  }
  const productColumn =
    input.priceCurrency === "UAH"
      ? Prisma.sql`canonical_product."priceUah"`
      : input.priceCurrency === "EUR"
        ? Prisma.sql`canonical_product."priceEur"`
        : Prisma.sql`canonical_product."priceUsd"`;
  const variantColumn =
    input.priceCurrency === "UAH"
      ? Prisma.sql`canonical_variant."priceUah"`
      : input.priceCurrency === "EUR"
        ? Prisma.sql`canonical_variant."priceEur"`
        : Prisma.sql`canonical_variant."priceUsd"`;
  const projectionColumn =
    input.priceCurrency === "UAH"
      ? Prisma.sql`projection."minPriceUah"`
      : input.priceCurrency === "EUR"
        ? Prisma.sql`projection."minPriceEur"`
        : Prisma.sql`projection."minPriceUsd"`;
  return Prisma.sql`COALESCE(
    (SELECT COALESCE(NULLIF(${productColumn}, 0), NULLIF(${variantColumn}, 0))
     FROM "ShopProduct" canonical_product
     LEFT JOIN LATERAL (
       SELECT variant."priceEur", variant."priceEurEurope", variant."priceUsd", variant."priceUah"
       FROM "ShopProductVariant" variant
       WHERE variant."productId" = canonical_product."id"
       ORDER BY variant."isDefault" DESC, variant."position" ASC
       LIMIT 1
     ) canonical_variant ON true
     WHERE canonical_product."id" = projection."productId"),
    NULLIF(${projectionColumn}, 0)
  )`;
}

function canonicalProjectionBrandSql() {
  return Prisma.sql`regexp_replace(lower(COALESCE(
    (SELECT COALESCE(NULLIF(trim(brand_product."brand"), ''), NULLIF(trim(brand_product."vendor"), ''))
     FROM "ShopProduct" brand_product
     WHERE brand_product."id" = projection."productId"),
    projection."brandLabel",
    projection."brandKey"
  )), '[^a-z0-9]+', '', 'g')`;
}

function textConstraint(
  dimension: ShopCatalogCompatibilityDimension,
  value: string,
  make?: string | null,
  modelAlternates?: readonly string[] | null
): Prisma.ShopCatalogProjectionConstraintWhereInput {
  const modelValues = make
    ? [
        ...new Set(
          [value, ...(modelAlternates ?? [])].flatMap((model) => vehicleModelAliases(make, model))
        ),
      ]
    : [value];
  return {
    dimension,
    OR: [
      {
        state: { in: [ShopCatalogConstraintState.ANY, ShopCatalogConstraintState.NOT_APPLICABLE] },
      },
      {
        state: ShopCatalogConstraintState.EXACT,
        textValue: {
          in:
            dimension === ShopCatalogCompatibilityDimension.MODEL && make
              ? modelValues
              : dimension === ShopCatalogCompatibilityDimension.MAKE
                ? vehicleMakeAliases(value)
                : [value],
          mode: "insensitive",
        },
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

function compactSearchCode(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isStructuredSearchCode(value: string) {
  return value.length >= 4 && /[a-z]/u.test(value) && /\d/u.test(value);
}

/**
 * Projection search text is normalized at build time. Matching the raw query
 * as one contiguous phrase made valid vehicle searches order-sensitive (for
 * example, `G90 BMW M5`) and missed SKUs whose separators differ from the
 * stored value. Keep all query tokens mandatory, while allowing an exact
 * normalized product or variant SKU to win independently.
 */
function projectionSearchConditionSql(text: string) {
  const tokens = tokenizeShopSearchQuery(text);
  const normalized = normalizeShopSearchText(text);
  const tokenCondition = tokens.length
    ? Prisma.sql`(${Prisma.join(
        tokens.map((token) =>
          shopSearchTokenConditionSql(Prisma.sql`projection."searchText"`, token)
        ),
        " AND "
      )})`
    : Prisma.sql`projection."searchText" ILIKE ${`%${escapeLike(normalized)}%`} ESCAPE '\\'`;
  const compact = compactSearchCode(text);
  if (!isStructuredSearchCode(compact)) return tokenCondition;
  return Prisma.sql`(
    lower(coalesce(projection."normalizedSku", '')) = lower(${compact})
    OR EXISTS (
      SELECT 1
      FROM "ShopCatalogProjectionSku" projection_sku
      WHERE projection_sku."productId" = projection."productId"
        AND projection_sku."sourceVersion" = projection."sourceVersion"
        AND lower(projection_sku."normalizedSku") = lower(${compact})
      OFFSET 0
    )
    OR ${tokenCondition}
  )`;
}

/**
 * Product ids whose indexed search text names every word of `text`. Used to
 * widen a selected vehicle (structured fitment covers only part of the
 * catalog) with products that state the vehicle in their title or fitment text.
 */
export async function queryShopCatalogProjectionIdsByText(input: {
  locale: "ua" | "en";
  text: string;
  excludeScope?: string | null;
  limit?: number;
}): Promise<string[]> {
  const text = input.text.trim();
  if (!text) return [];
  const conditions: Prisma.Sql[] = [
    Prisma.sql`projection."locale" = ${input.locale}`,
    Prisma.sql`projection."isPublished" = true`,
    Prisma.sql`projection."statusKey" = 'ACTIVE'`,
    projectionSearchConditionSql(text),
  ];
  if (input.excludeScope) {
    conditions.push(Prisma.sql`projection."scopeKey" <> ${input.excludeScope}`);
  }
  const rows = await prisma.$queryRaw<Array<{ productId: string }>>(Prisma.sql`
    SELECT projection."productId"
    FROM "ShopCatalogProjection" projection
    WHERE ${Prisma.join(conditions, " AND ")}
    LIMIT ${Math.min(Math.max(input.limit ?? 5000, 1), 5000)}`);
  return rows.map((row) => row.productId);
}

/**
 * Rank only the already indexed candidate set. The projection search text is
 * intentionally broad for recall, while title/brand/SKU weights keep buyer
 * intent ahead of incidental mentions in descriptions and fitment metadata.
 */
/**
 * Identity fields must outweigh incidental mentions. `searchText` also carries
 * fitment lists and descriptions (for example "kW" power figures), so its
 * full-text rank is a tie-breaker, not a signal that can outrank a product
 * whose own title or brand matches the query.
 */
export const SHOP_CATALOG_SEARCH_RELEVANCE_WEIGHTS = Object.freeze({
  titleToken: 120,
  brandToken: 35,
  namedBrandToken: 400,
  searchTextRank: 100,
});

function projectionSearchRelevanceSql(text: string) {
  const weights = SHOP_CATALOG_SEARCH_RELEVANCE_WEIGHTS;
  const normalized = normalizeShopSearchText(text);
  const compact = compactSearchCode(text);
  const tokens = tokenizeShopSearchQuery(text);
  const titleTokenScore = tokens.length
    ? Prisma.sql`(${Prisma.join(
        tokens.map(
          (token) =>
            Prisma.sql`CASE WHEN ${shopSearchTokenConditionSql(Prisma.sql`lower(projection."title")`, token)} THEN ${Prisma.raw(String(weights.titleToken))} ELSE 0 END`
        ),
        " + "
      )})`
    : Prisma.sql`0`;
  const brandTokenScore = tokens.length
    ? Prisma.sql`(${Prisma.join(
        tokens.map(
          (token) =>
            Prisma.sql`CASE WHEN ${shopSearchTokenConditionSql(Prisma.sql`lower(coalesce(projection."brandLabel", projection."brandKey"))`, token)} THEN ${Prisma.raw(String(isShopSearchBrandToken(token) ? weights.namedBrandToken : weights.brandToken))} ELSE 0 END`
        ),
        " + "
      )})`
    : Prisma.sql`0`;
  const exactSku = isStructuredSearchCode(compact)
    ? Prisma.sql`CASE WHEN (
        lower(coalesce(projection."normalizedSku", '')) = lower(${compact})
        OR EXISTS (
          SELECT 1
          FROM "ShopCatalogProjectionSku" relevance_sku
          WHERE relevance_sku."productId" = projection."productId"
            AND relevance_sku."sourceVersion" = projection."sourceVersion"
            AND lower(relevance_sku."normalizedSku") = lower(${compact})
          OFFSET 0
        )
      ) THEN 100000 ELSE 0 END`
    : Prisma.sql`0`;
  const skuSimilarity = compact
    ? Prisma.sql`similarity(lower(coalesce(projection."normalizedSku", '')), lower(${compact})) * 500`
    : Prisma.sql`0`;
  return Prisma.sql`(
    ${exactSku}
    + CASE WHEN lower(projection."title") = lower(${normalized}) THEN 10000 ELSE 0 END
    + ${titleTokenScore}
    + ${brandTokenScore}
    + ${skuSimilarity}
    + ts_rank_cd(
        to_tsvector('simple', projection."searchText"),
        plainto_tsquery('simple', ${normalized}),
        32
      ) * ${Prisma.raw(String(weights.searchTextRank))}
    + similarity(lower(projection."title"), lower(${normalized})) * 100
  )`;
}

function correlatedTextConstraintSql(
  dimension: ShopCatalogCompatibilityDimension,
  value: string,
  make?: string | null,
  modelAlternates?: readonly string[] | null,
  lowerTier = false
) {
  const modelKeys = make
    ? [
        ...new Set(
          [value, ...(modelAlternates ?? [])]
            // Selecting a base model includes its trims (`911` -> `911 GT3`).
            .flatMap((model) => {
              const scope = vehicleModelScope(make, model);
              return lowerTier ? scope.broad : scope.exact;
            })
            .flatMap((model) => vehicleModelAliases(make, model))
            .map(vehicleModelKey)
        ),
      ]
    : [vehicleModelKey(value)];
  const isGeneration = dimension === ShopCatalogCompatibilityDimension.GENERATION;
  const generationLike = isGeneration ? escapeLike(value.toLowerCase()) : "";
  const generationAncestors =
    isGeneration && lowerTier
      ? vehicleChassisSelfAndAncestors(value)
          .slice(1)
          .map((ancestor) => ancestor.toLowerCase())
      : [];
  // Spelling variants share one key (`W 463A` = `W-463A` = `W463A`), as in
  // the selector options.
  const generationKeys = isGeneration
    ? [
        ...new Set(
          [value, ...(lowerTier ? vehicleChassisSelfAndAncestors(value).slice(1) : [])]
            .map(vehicleChassisKey)
            .filter(Boolean)
        ),
      ]
    : [];
  const exactMatch =
    dimension === ShopCatalogCompatibilityDimension.MODEL
      ? Prisma.sql`regexp_replace(translate(lower(compatibility_constraint."textValue"), 'áàâäãåéèêëíìîïóòôöõúùûüýÿçñ', 'aaaaaaeeeeiiiiooooouuuuyycn'), '[^a-z0-9]+', '', 'g') IN (${Prisma.join(modelKeys)})`
      : dimension === ShopCatalogCompatibilityDimension.MAKE
        ? Prisma.sql`lower(compatibility_constraint."textValue") IN (${Prisma.join(vehicleMakeAliases(value).map((alias) => alias.toLowerCase()))})`
        : isGeneration
          ? // The generation and its facelifts (`992` -> `992.1`, `G20 LCI`).
            Prisma.sql`(
              lower(compatibility_constraint."textValue") = lower(${value})
              ${
                generationKeys.length
                  ? Prisma.sql`OR regexp_replace(lower(compatibility_constraint."textValue"), '[^a-z0-9.]+', '', 'g') IN (${Prisma.join(generationKeys)})`
                  : Prisma.empty
              }
              OR lower(compatibility_constraint."textValue") LIKE ${`${generationLike}.%`} ESCAPE '\\'
              OR lower(compatibility_constraint."textValue") LIKE ${`${generationLike} %`} ESCAPE '\\'
              ${
                generationAncestors.length
                  ? Prisma.sql`OR lower(compatibility_constraint."textValue") IN (${Prisma.join(generationAncestors)})`
                  : Prisma.empty
              }
            )`
          : Prisma.sql`lower(compatibility_constraint."textValue") = lower(${value})`;
  // Suppliers file the same generation under either dimension.
  const dimensionMatch = isGeneration
    ? Prisma.sql`compatibility_constraint."dimension" IN ('GENERATION', 'CHASSIS')`
    : Prisma.sql`compatibility_constraint."dimension" = ${dimension}::"ShopCatalogCompatibilityDimension"`;
  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "ShopCatalogProjectionConstraint" compatibility_constraint
      WHERE compatibility_constraint."targetKey" = clause."targetKey"
        AND compatibility_constraint."clauseKey" = clause."clauseKey"
        AND compatibility_constraint."productId" = clause."productId"
        AND compatibility_constraint."sourceVersion" = clause."sourceVersion"
        AND ${dimensionMatch}
        AND (
          compatibility_constraint."state" IN ('ANY', 'NOT_APPLICABLE')
          OR (
            compatibility_constraint."state" = 'EXACT'
            AND ${exactMatch}
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

/**
 * A product-group id or label (UA/EN) selects by the taxonomy group stored on
 * every projection row; any other value keeps matching the admin category
 * key/label so existing links to specific categories continue to work.
 */
function projectionCategoryConditionSql(category: string, groupsReady: boolean) {
  const groupId = groupsReady ? resolveShopStockCategoryGroupId(category) : null;
  if (groupId) return Prisma.sql`projection."categoryGroupKey" = ${groupId}`;
  return Prisma.sql`(lower(projection."categoryKey") = lower(${category}) OR lower(projection."categoryLabel") = lower(${category}))`;
}

function categoryGroupLabel(groupKey: string | null | undefined, locale: string) {
  const groupId = resolveShopStockCategoryGroupId(groupKey);
  return groupId ? getShopStockCategoryLabel(groupId, locale) : null;
}

function projectionFacetBaseConditions(
  input: ReturnType<typeof normalizeShopCatalogProjectionQuery>,
  includeBrand: boolean,
  includeCategory = true,
  priceOverride?: Prisma.Sql
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`projection."locale" = ${input.locale}`,
    Prisma.sql`projection."isPublished" = true`,
    isExactWheelForceSkuSearch(input.text)
      ? Prisma.sql`projection."statusKey" IN ('ACTIVE', 'FAMILY_CHILD')`
      : Prisma.sql`projection."statusKey" = 'ACTIVE'`,
  ];
  if (input.productIds) {
    conditions.push(
      input.productIds.length
        ? Prisma.sql`projection."productId" IN (${Prisma.join(input.productIds)})`
        : Prisma.sql`false`
    );
  }
  if (input.excludeProductIds?.length) {
    conditions.push(
      Prisma.sql`projection."productId" NOT IN (${Prisma.join(input.excludeProductIds)})`
    );
  }
  const price = priceOverride ?? projectionPriceSql(input);
  if (input.minPrice != null) conditions.push(Prisma.sql`${price} >= ${input.minPrice}`);
  if (input.maxPrice != null) conditions.push(Prisma.sql`${price} <= ${input.maxPrice}`);
  if (input.scope) conditions.push(Prisma.sql`projection."scopeKey" = ${input.scope}`);
  if (input.excludeScope) {
    conditions.push(Prisma.sql`projection."scopeKey" <> ${input.excludeScope}`);
  }
  if (includeBrand && input.brand) {
    conditions.push(projectionBrandConditionSql(input.brand));
  }
  if (includeCategory && input.category) {
    conditions.push(
      projectionCategoryConditionSql(input.category, input.categoryGroupsReady !== false)
    );
  }
  if (input.text) {
    conditions.push(projectionSearchConditionSql(input.text));
  }
  return conditions;
}

/** All selected dimensions must be satisfied by the same version of one clause. */
function selectedVehicleCondition(
  input: ReturnType<typeof normalizeShopCatalogProjectionQuery>,
  lowerTier = input.vehicleLowerTier
): Prisma.Sql | null {
  const constraints: Prisma.Sql[] = [];
  for (const field of Object.keys(VEHICLE_DIMENSIONS) as VehicleDimension[]) {
    const value = input[field];
    if (value)
      constraints.push(
        correlatedTextConstraintSql(
          VEHICLE_DIMENSIONS[field],
          value,
          input.make,
          input.modelAlternates,
          lowerTier
        )
      );
  }
  if (input.year != null) constraints.push(correlatedYearConstraintSql(input.year));
  if (!constraints.length) return null;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionPolicy" policy
    JOIN "ShopCatalogProjectionClause" clause
      ON clause."targetKey" = policy."targetKey"
     AND clause."productId" = policy."productId"
     AND clause."sourceVersion" = policy."sourceVersion"
    WHERE policy."productId" = projection."productId"
      AND policy."mode" IN ('VEHICLE_SPECIFIC', 'UNIVERSAL')
      AND clause."verification" = 'VERIFIED'
      AND ${Prisma.join(constraints, " AND ")}
    OFFSET 0
  )`;
}

/** Reuse the exact verified-clause predicate for product suggestions. */
export function buildShopCatalogProjectionVehicleCondition(
  raw: Omit<ShopCatalogProjectionQueryInput, "locale"> & { locale?: "ua" | "en" }
) {
  return selectedVehicleCondition(
    normalizeShopCatalogProjectionQuery({ ...raw, locale: raw.locale ?? "ua" })
  );
}

/** True when a broader label (`992`, `911`) can match this selection too. */
export function shopCatalogProjectionVehicleLowerTierApplies(raw: ShopCatalogProjectionQueryInput) {
  return vehicleLowerTierApplies(normalizeShopCatalogProjectionQuery(raw));
}

function vehicleLowerTierApplies(input: ReturnType<typeof normalizeShopCatalogProjectionQuery>) {
  if (!input.vehicleLowerTier) return false;
  if (input.generation && vehicleChassisSelfAndAncestors(input.generation).length > 1) return true;
  if (!input.make) return false;
  return [input.model, ...(input.modelAlternates ?? [])].some((model) => {
    if (!model) return false;
    const scope = vehicleModelScope(input.make!, model);
    return scope.broad.length > scope.exact.length;
  });
}

/**
 * Of the given products, the ones that match the selected vehicle exactly (not
 * only through a broader label). Used to flag lower-tier cards.
 */
export async function queryShopCatalogProjectionExactVehicleIds(
  raw: ShopCatalogProjectionQueryInput,
  productIds: readonly string[]
): Promise<Set<string>> {
  const input = normalizeShopCatalogProjectionQuery(raw);
  const ids = [...new Set(productIds)];
  const exact = selectedVehicleCondition(input, false);
  if (!ids.length || !exact) return new Set(ids);
  const rows = await prisma.$queryRaw<Array<{ productId: string }>>(Prisma.sql`
    SELECT DISTINCT projection."productId"
    FROM "ShopCatalogProjection" projection
    WHERE projection."locale" = ${input.locale}
      AND projection."productId" IN (${Prisma.join(ids)})
      AND ${exact}
  `);
  return new Set(rows.map((row) => row.productId));
}

function projectionBrandConditionSql(brand: string): Prisma.Sql {
  if (isUrbanProductBrand(brand)) {
    return Prisma.sql`(
      lower(projection."brandKey") IN (${Prisma.join(URBAN_PRODUCT_BRAND_ALIASES)})
      OR lower(projection."brandLabel") IN (${Prisma.join(URBAN_PRODUCT_BRAND_ALIASES)})
    )`;
  }
  return Prisma.sql`(lower(projection."brandKey") = lower(${brand}) OR lower(projection."brandLabel") = lower(${brand}))`;
}

function selectedVehicleFacetConstraints(
  input: ReturnType<typeof normalizeShopCatalogProjectionQuery>,
  before: VehicleDimension | "year"
) {
  const order: Array<VehicleDimension | "year"> = [
    "make",
    "model",
    "generation",
    "year",
    "engine",
    "fuel",
    "opfGpf",
  ];
  // OPF/GPF has no output facet, so it is terminal: every visible candidate
  // facet must still stay in the selected clause when it is selected.
  const fields = new Set<VehicleDimension | "year">([
    ...order.slice(0, order.indexOf(before)),
    ...(before === "opfGpf" ? [] : ["opfGpf" as const]),
  ]);
  const constraints: Prisma.Sql[] = [];
  for (const field of fields) {
    if (field === "year") {
      if (input.year != null) constraints.push(correlatedYearConstraintSql(input.year));
      continue;
    }
    const value = input[field];
    if (value)
      constraints.push(
        correlatedTextConstraintSql(
          VEHICLE_DIMENSIONS[field],
          value,
          input.make,
          input.modelAlternates,
          input.vehicleLowerTier
        )
      );
  }
  return constraints;
}

type ProjectionFacetSource = {
  prefix: Prisma.Sql;
  from: Prisma.Sql;
  conditions: (includeBrand: boolean, includeCategory?: boolean) => Prisma.Sql[];
};

function buildProjectionFacetSource(
  input: ReturnType<typeof normalizeShopCatalogProjectionQuery>
): ProjectionFacetSource {
  if (!input.effectivePriceContext || (input.minPrice == null && input.maxPrice == null)) {
    return {
      prefix: Prisma.empty,
      from: Prisma.sql`"ShopCatalogProjection" projection`,
      conditions: (includeBrand, includeCategory = true) =>
        projectionFacetBaseConditions(input, includeBrand, includeCategory),
    };
  }
  // Price is common to every facet, whereas brand/category and vehicle prefixes
  // intentionally differ between branches. Materialize only the shared candidate
  // fields once; do not repeat canonical/default-variant pricing in every UNION.
  const common = projectionFacetBaseConditions(input, false, false, Prisma.sql`facet_price.amount`);
  return {
    prefix: Prisma.sql`WITH priced_facet_projection AS MATERIALIZED (
      SELECT projection."productId", projection."brandKey", projection."brandLabel",
             projection."categoryKey", projection."categoryLabel", projection."categoryGroupKey"
      FROM "ShopCatalogProjection" projection
      CROSS JOIN LATERAL (SELECT ${projectionPriceSql(input)} AS amount OFFSET 0) facet_price
      WHERE ${Prisma.join(common, " AND ")}
    )`,
    from: Prisma.sql`priced_facet_projection projection`,
    conditions: (includeBrand, includeCategory = true) => {
      const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
      if (includeBrand && input.brand) conditions.push(projectionBrandConditionSql(input.brand));
      if (includeCategory && input.category) {
        conditions.push(
          projectionCategoryConditionSql(input.category, input.categoryGroupsReady !== false)
        );
      }
      return conditions;
    },
  };
}

function vehicleFacetBranch(
  input: ReturnType<typeof normalizeShopCatalogProjectionQuery>,
  field: VehicleDimension | "year",
  source: ProjectionFacetSource
) {
  const dimension =
    field === "year" ? ShopCatalogCompatibilityDimension.YEAR : VEHICLE_DIMENSIONS[field];
  const prefix = selectedVehicleFacetConstraints(input, field);
  const conditions = source.conditions(true);
  const key =
    field === "year"
      ? Prisma.sql`concat(coalesce(candidate."yearFrom"::text, ''), ':', coalesce(candidate."yearTo"::text, ''))`
      : Prisma.sql`lower(candidate."textValue")`;
  const label =
    field === "year"
      ? Prisma.sql`CASE
          WHEN candidate."yearFrom" IS NULL THEN concat('≤', candidate."yearTo")
          WHEN candidate."yearTo" IS NULL THEN concat(candidate."yearFrom", '+')
          WHEN candidate."yearFrom" = candidate."yearTo" THEN candidate."yearFrom"::text
          ELSE concat(candidate."yearFrom", '–', candidate."yearTo")
        END`
      : Prisma.sql`min(candidate."textValue")`;

  return Prisma.sql`
    (SELECT
       ${field}::text AS "dimension",
       ${key} AS "key",
       ${label} AS "label",
       count(DISTINCT projection."productId")::bigint AS "count",
       ${field === "year" ? Prisma.sql`candidate."yearFrom"` : Prisma.sql`NULL::integer`} AS "yearFrom",
       ${field === "year" ? Prisma.sql`candidate."yearTo"` : Prisma.sql`NULL::integer`} AS "yearTo"
     FROM ${source.from}
     JOIN LATERAL (
       SELECT candidate_row.*
       FROM "ShopCatalogProjectionPolicy" policy
       JOIN "ShopCatalogProjectionClause" clause
         ON clause."targetKey" = policy."targetKey"
        AND clause."productId" = policy."productId"
        AND clause."sourceVersion" = policy."sourceVersion"
       JOIN "ShopCatalogProjectionConstraint" candidate_row
         ON candidate_row."targetKey" = clause."targetKey"
        AND candidate_row."clauseKey" = clause."clauseKey"
        AND candidate_row."productId" = clause."productId"
        AND candidate_row."sourceVersion" = clause."sourceVersion"
        AND candidate_row."dimension" = ${dimension}::"ShopCatalogCompatibilityDimension"
        AND candidate_row."state" = 'EXACT'
       WHERE policy."productId" = projection."productId"
         AND policy."mode" IN ('VEHICLE_SPECIFIC', 'UNIVERSAL')
         AND clause."verification" = 'VERIFIED'
         ${prefix.length ? Prisma.sql`AND ${Prisma.join(prefix, " AND ")}` : Prisma.empty}
       OFFSET 0
     ) candidate
       ON true
     WHERE ${Prisma.join(conditions, " AND ")}
       AND ${
         field === "year"
           ? Prisma.sql`(candidate."yearFrom" IS NOT NULL OR candidate."yearTo" IS NOT NULL)`
           : Prisma.sql`candidate."textValue" IS NOT NULL AND candidate."textValue" <> ''`
       }
     GROUP BY ${key}${field === "year" ? Prisma.sql`, candidate."yearFrom", candidate."yearTo"` : Prisma.empty}
     ORDER BY "count" DESC, "label" ASC
     LIMIT ${SHOP_CATALOG_PROJECTION_FACET_LIMIT})`;
}

/** One bounded round-trip returns cascading facets; each vehicle option stays in one clause. */
export function buildShopCatalogProjectionFacetQuerySql(
  raw: ShopCatalogProjectionQueryInput
): Prisma.Sql {
  const input = normalizeShopCatalogProjectionQuery(raw);
  const source = buildProjectionFacetSource(input);
  const vehicleCondition = selectedVehicleCondition(input);
  const brandBranch =
    input.text ||
    input.productIds ||
    input.excludeProductIds?.length ||
    input.category ||
    input.minPrice != null ||
    input.maxPrice != null ||
    vehicleCondition
      ? (() => {
          const brandConditions = source.conditions(false);
          if (vehicleCondition) brandConditions.push(vehicleCondition);
          return Prisma.sql`
          (SELECT
             'brand'::text AS "dimension",
             projection."brandKey" AS "key",
             min(projection."brandLabel") AS "label",
             count(*)::bigint AS "count",
             NULL::integer AS "yearFrom",
             NULL::integer AS "yearTo"
           FROM ${source.from}
           WHERE ${Prisma.join(brandConditions, " AND ")}
             AND projection."brandKey" <> ''
           GROUP BY projection."brandKey"
           ORDER BY "count" DESC, "label" ASC
           LIMIT ${SHOP_CATALOG_PROJECTION_FACET_LIMIT})`;
        })()
      : input.excludeScope
        ? // Unpartitioned counters minus the excluded partition: still one
          // indexed read of the maintained counters, no projection scan.
          Prisma.sql`
        (SELECT
           'brand'::text AS "dimension",
           facet."valueKey" AS "key",
           min(facet."valueLabel") AS "label",
           sum(CASE WHEN facet."prefixKey" = '' THEN facet."productCount" ELSE -facet."productCount" END)::bigint AS "count",
           NULL::integer AS "yearFrom",
           NULL::integer AS "yearTo"
         FROM "ShopCatalogProjectionFacetCount" facet
         WHERE facet."locale" = ${input.locale}
           AND facet."dimension" = 'BRAND'
           AND facet."prefixKey" IN ('', ${`scope:${input.excludeScope}`})
         GROUP BY facet."valueKey"
         HAVING sum(CASE WHEN facet."prefixKey" = '' THEN facet."productCount" ELSE -facet."productCount" END) > 0
         ORDER BY "count" DESC, "label" ASC
         LIMIT ${SHOP_CATALOG_PROJECTION_FACET_LIMIT})`
        : Prisma.sql`
        (SELECT
           'brand'::text AS "dimension",
           facet."valueKey" AS "key",
           facet."valueLabel" AS "label",
           facet."productCount"::bigint AS "count",
           NULL::integer AS "yearFrom",
           NULL::integer AS "yearTo"
         FROM "ShopCatalogProjectionFacetCount" facet
         WHERE facet."locale" = ${input.locale}
           AND facet."dimension" = 'BRAND'
           AND facet."prefixKey" = ${input.scope ? `scope:${input.scope}` : ""}
           AND facet."productCount" > 0
         ORDER BY facet."productCount" DESC, facet."valueLabel" ASC
         LIMIT ${SHOP_CATALOG_PROJECTION_FACET_LIMIT})`;
  const categoryConditions = source.conditions(true, false);
  if (vehicleCondition) categoryConditions.push(vehicleCondition);
  // Until every row carries a taxonomy group, keep counting the admin category.
  const categoryColumn =
    input.categoryGroupsReady !== false
      ? Prisma.sql`projection."categoryGroupKey"`
      : Prisma.sql`projection."categoryKey"`;
  const categoryLabelColumn =
    input.categoryGroupsReady !== false ? categoryColumn : Prisma.sql`projection."categoryLabel"`;
  const categoryBranch = Prisma.sql`
    (SELECT
       'category'::text AS "dimension",
       ${categoryColumn} AS "key",
       min(${categoryLabelColumn}) AS "label",
       count(*)::bigint AS "count",
       NULL::integer AS "yearFrom",
       NULL::integer AS "yearTo"
     FROM ${source.from}
     WHERE ${Prisma.join(categoryConditions, " AND ")}
       AND ${categoryColumn} IS NOT NULL
       AND ${categoryColumn} <> ''
     GROUP BY ${categoryColumn}
     ORDER BY "count" DESC, "label" ASC
     LIMIT ${SHOP_CATALOG_PROJECTION_FACET_LIMIT})`;
  const branches = [brandBranch, categoryBranch];
  // Vehicle selection is independent of the product manufacturer. Aggregate
  // existing per-brand make counters for the all-brand entry point; this avoids
  // scanning every policy just to show the initial make dropdown.
  const liveMakeCounts = Boolean(
    input.text ||
      input.opfGpf ||
      input.productIds ||
      input.excludeProductIds?.length ||
      input.category ||
      input.minPrice != null ||
      input.maxPrice != null ||
      isUrbanProductBrand(input.brand ?? "")
  );
  if (!input.brand && !liveMakeCounts) {
    branches.push(Prisma.sql`
      (SELECT 'make'::text AS "dimension", facet."valueKey" AS "key",
         min(facet."valueLabel") AS "label", sum(facet."productCount")::bigint AS "count",
         NULL::integer AS "yearFrom", NULL::integer AS "yearTo"
       FROM "ShopCatalogProjectionFacetCount" facet
       WHERE facet."locale" = ${input.locale} AND facet."dimension" = 'MAKE'
         AND facet."prefixKey" LIKE ${input.scope ? `scope:${escapeLike(input.scope)}|brand:%` : input.excludeScope ? "scope:%|brand:%" : "brand:%"} ESCAPE '\\'
         ${input.excludeScope ? Prisma.sql`AND facet."prefixKey" NOT LIKE ${`scope:${escapeLike(input.excludeScope)}|%`} ESCAPE '\\'` : Prisma.empty}
         AND facet."productCount" > 0
       GROUP BY facet."valueKey"
       ORDER BY "count" DESC, "label" ASC
       LIMIT ${SHOP_CATALOG_PROJECTION_FACET_LIMIT})`);
  } else {
    branches.push(
      liveMakeCounts
        ? vehicleFacetBranch(input, "make", source)
        : Prisma.sql`
      (SELECT 'make'::text AS "dimension", facet."valueKey" AS "key",
         min(facet."valueLabel") AS "label", sum(facet."productCount")::bigint AS "count",
         NULL::integer AS "yearFrom", NULL::integer AS "yearTo"
       FROM "ShopCatalogProjectionFacetCount" facet
       WHERE facet."locale" = ${input.locale} AND facet."dimension" = 'MAKE'
         AND ${
           input.scope
             ? Prisma.sql`facet."prefixKey" = ${`scope:${input.scope}|brand:${input.brand!.toLowerCase()}`}`
             : input.excludeScope
               ? Prisma.sql`facet."prefixKey" LIKE ${`scope:%|brand:${escapeLike(input.brand!.toLowerCase())}`} ESCAPE '\\'
                   AND facet."prefixKey" NOT LIKE ${`scope:${escapeLike(input.excludeScope)}|%`} ESCAPE '\\'`
               : Prisma.sql`facet."prefixKey" = ${`brand:${input.brand!.toLowerCase()}`}`
         }
         AND facet."productCount" > 0
       GROUP BY facet."valueKey"
       ORDER BY "count" DESC, "label" ASC
       LIMIT ${SHOP_CATALOG_PROJECTION_FACET_LIMIT})`
    );
  }
  if (input.make) branches.push(vehicleFacetBranch(input, "model", source));
  if (input.make && input.model) {
    branches.push(vehicleFacetBranch(input, "generation", source));
    branches.push(vehicleFacetBranch(input, "year", source));
    branches.push(vehicleFacetBranch(input, "engine", source));
    branches.push(vehicleFacetBranch(input, "fuel", source));
  }
  return Prisma.sql`${source.prefix} ${Prisma.join(branches, " UNION ALL ")}`;
}

export async function queryShopCatalogProjectionFacets(
  raw: ShopCatalogProjectionQueryInput
): Promise<ShopCatalogProjectionFacetResult> {
  raw = await withCategoryGroupMode(raw);
  const rows = await prisma.$queryRaw<
    Array<{
      dimension: keyof ShopCatalogProjectionFacetResult["facets"];
      key: string;
      label: string;
      count: bigint;
      yearFrom: number | null;
      yearTo: number | null;
    }>
  >(buildShopCatalogProjectionFacetQuerySql(raw));
  const facets: Record<
    keyof ShopCatalogProjectionFacetResult["facets"],
    ShopCatalogProjectionFacetItem[]
  > = {
    brand: [],
    category: [],
    make: [],
    model: [],
    generation: [],
    year: [],
    engine: [],
    fuel: [],
  };
  for (const row of rows) {
    if (!(row.dimension in facets)) continue;
    const count = Number(row.count);
    if (!Number.isSafeInteger(count) || count < 1) continue;
    facets[row.dimension].push({
      key: row.key,
      label:
        row.dimension === "category" && raw.categoryGroupsReady
          ? (categoryGroupLabel(row.key, raw.locale) ?? row.label)
          : row.label,
      count,
      yearFrom: row.yearFrom,
      yearTo: row.yearTo,
    });
  }
  // The catch-all group always goes last, whatever its size.
  facets.category.sort(
    (left, right) =>
      Number(left.key === "other") - Number(right.key === "other") || right.count - left.count
  );
  if (raw.make && facets.model.length) {
    const canonicalModels = new Map<string, ShopCatalogProjectionFacetItem>();
    for (const item of facets.model) {
      for (const label of canonicalizeVehicleModels(raw.make, [item.label])) {
        const key = vehicleModelKey(label);
        const existing = canonicalModels.get(key);
        canonicalModels.set(key, {
          ...item,
          key,
          label,
          count: (existing?.count ?? 0) + item.count,
        });
      }
    }
    facets.model = [...canonicalModels.values()].sort((left, right) =>
      left.label.localeCompare(right.label, "en", { numeric: true, sensitivity: "base" })
    );
  }
  return Object.freeze({
    source: "catalog_v2_projection",
    facets: Object.freeze(
      Object.fromEntries(
        Object.entries(facets).map(([key, value]) => [key, Object.freeze(value)])
      ) as ShopCatalogProjectionFacetResult["facets"]
    ),
  });
}

export function buildShopCatalogProjectionVehicleQuerySql(
  raw: ShopCatalogProjectionQueryInput
): Prisma.Sql | null {
  const input = normalizeShopCatalogProjectionQuery(raw);
  const vehicleCondition = selectedVehicleCondition(input);
  if (!vehicleCondition) return null;
  const projectionConditions = projectionFacetBaseConditions(input, true);
  projectionConditions.push(vehicleCondition);
  if (input.after) {
    projectionConditions.push(
      Prisma.sql`(projection."stableRank" > ${input.after.stableRank}::numeric OR (projection."stableRank" = ${input.after.stableRank}::numeric AND projection."productId" > ${input.after.productId}))`
    );
  }

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
      projection."categoryGroupKey",
      projection."productTypeKey",
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

export function buildShopCatalogProjectionOrderedQuerySql(
  raw: ShopCatalogProjectionQueryInput
): Prisma.Sql | null {
  const input = normalizeShopCatalogProjectionQuery(raw);
  // Price filters use canonical prices, which cannot be expressed by the
  // projection-only ORM path. Keep them on SQL even on the first default page.
  if (
    input.order === "default" &&
    input.offset === 0 &&
    input.minPrice == null &&
    input.maxPrice == null &&
    input.text == null &&
    !input.priorityProductIds?.length &&
    !vehicleLowerTierApplies(input)
  )
    return null;
  const reuseEffectivePrice = Boolean(
    input.effectivePriceContext &&
      (input.minPrice != null ||
        input.maxPrice != null ||
        input.order === "price_asc" ||
        input.order === "price_desc" ||
        input.order === "brand_interleave")
  );
  const price = reuseEffectivePrice ? Prisma.sql`ordered_price.amount` : projectionPriceSql(input);
  // Keep one canonical/default-variant lookup per candidate even when both
  // bounds and ordering use it. OFFSET 0 prevents scalar-subquery inlining.
  const priceJoin = reuseEffectivePrice
    ? Prisma.sql`CROSS JOIN LATERAL (SELECT ${projectionPriceSql(input)} AS amount OFFSET 0) ordered_price`
    : Prisma.empty;
  const conditions = projectionFacetBaseConditions(input, true, true, price);
  if (input.after) {
    conditions.push(
      Prisma.sql`(projection."stableRank" > ${input.after.stableRank}::numeric OR (projection."stableRank" = ${input.after.stableRank}::numeric AND projection."productId" > ${input.after.productId}))`
    );
  }
  const vehicleCondition = selectedVehicleCondition(input);
  if (vehicleCondition) conditions.push(vehicleCondition);
  const canonicalBrand = canonicalProjectionBrandSql();
  const seed =
    input.orderSeed ??
    [
      input.text,
      input.make,
      input.model,
      input.generation,
      input.year?.toString(),
      input.engine,
      input.fuel,
      input.opfGpf,
      input.category,
    ]
      .filter(Boolean)
      .join("|");
  const order =
    input.order === "price_asc"
      ? Prisma.sql`${price} ASC NULLS LAST, projection."stableRank" ASC`
      : input.order === "price_desc"
        ? Prisma.sql`${price} DESC NULLS LAST, projection."stableRank" ASC`
        : input.order === "name_asc"
          ? Prisma.sql`lower(projection."title") ASC, projection."stableRank" ASC`
          : input.order === "brand_interleave"
            ? Prisma.sql`
                row_number() OVER (
                  PARTITION BY ${canonicalBrand}
                  ORDER BY ${price} DESC NULLS LAST, projection."stableRank" ASC, projection."productId" ASC
                ) ASC,
                md5(${canonicalBrand} || ${seed}) ASC,
                ${price} DESC NULLS LAST`
            : input.text
              ? Prisma.sql`${projectionSearchRelevanceSql(input.text)} DESC, projection."stableRank" ASC, projection."productId" ASC`
              : Prisma.sql`projection."stableRank" ASC, projection."productId" ASC`;
  // Exact vehicle matches lead; products that only match a broader label
  // (`992` for a 992.1 selection) follow. Explicit price/name sorts win.
  const exactVehicleCondition = vehicleLowerTierApplies(input)
    ? selectedVehicleCondition(input, false)
    : null;
  const priorityOrder =
    input.order === "default" || input.order === "brand_interleave"
      ? input.priorityProductIds?.length
        ? Prisma.sql`(projection."productId" IN (${Prisma.join(input.priorityProductIds)})) DESC, `
        : exactVehicleCondition
          ? Prisma.sql`(${exactVehicleCondition}) DESC, `
          : Prisma.empty
      : Prisma.empty;
  return Prisma.sql`
    SELECT
      projection."productId", projection."locale", projection."slug", projection."title",
      projection."cardCopy", projection."brandKey", projection."brandLabel",
      projection."categoryKey", projection."categoryLabel", projection."categoryGroupKey",
      projection."stableRank", projection."productTypeKey",
      projection."normalizedSku", projection."primaryMediaUrl", projection."minPriceEur",
      projection."minPriceEurEurope", projection."minPriceUsd", projection."minPriceUah",
      projection."contentHash", projection."projectionVersion"
    FROM "ShopCatalogProjection" projection
    ${priceJoin}
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ${priorityOrder}${order}, projection."productId" ASC
    LIMIT ${input.limit + 1}
    OFFSET ${input.offset}`;
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
    if (value)
      constraints.push(
        textConstraint(VEHICLE_DIMENSIONS[field], value, input.make, input.modelAlternates)
      );
  }
  if (input.year != null) constraints.push(yearConstraint(input.year));
  if (input.brand) {
    const urbanAliases = isUrbanProductBrand(input.brand) ? [...URBAN_PRODUCT_BRAND_ALIASES] : null;
    and.push({
      OR: urbanAliases
        ? [
            { brandKey: { in: urbanAliases, mode: "insensitive" } },
            { brandLabel: { in: urbanAliases, mode: "insensitive" } },
          ]
        : [
            { brandKey: { equals: input.brand, mode: "insensitive" } },
            { brandLabel: { equals: input.brand, mode: "insensitive" } },
          ],
    });
  }
  if (input.category) {
    const groupId =
      input.categoryGroupsReady !== false ? resolveShopStockCategoryGroupId(input.category) : null;
    and.push(
      groupId
        ? { categoryGroupKey: groupId }
        : {
            OR: [
              { categoryKey: { equals: input.category, mode: "insensitive" } },
              { categoryLabel: { equals: input.category, mode: "insensitive" } },
            ],
          }
    );
  }
  if (input.after) {
    and.push({
      OR: [
        { stableRank: { gt: input.after.stableRank } },
        { stableRank: input.after.stableRank, productId: { gt: input.after.productId } },
      ],
    });
  }
  if (input.excludeProductIds?.length) {
    and.push({ productId: { notIn: [...input.excludeProductIds] } });
  }

  if (input.text) {
    const tokens = tokenizeShopSearchQuery(input.text);
    const normalized = normalizeShopSearchText(input.text);
    const compact = compactSearchCode(input.text);
    const tokenCondition = tokens.length
      ? {
          AND: tokens.map((token) => ({
            searchText: { contains: token, mode: "insensitive" as const },
          })),
        }
      : { searchText: { contains: normalized, mode: "insensitive" as const } };
    and.push({
      OR: [
        ...(isStructuredSearchCode(compact)
          ? [{ normalizedSku: { equals: compact, mode: "insensitive" as const } }]
          : []),
        tokenCondition,
      ],
    });
  }

  return {
    locale: input.locale,
    isPublished: true,
    statusKey: isExactWheelForceSkuSearch(input.text)
      ? { in: ["ACTIVE", "FAMILY_CHILD"] }
      : "ACTIVE",
    ...(input.productIds ? { productId: { in: [...input.productIds] } } : {}),
    ...(input.scope
      ? { scopeKey: input.scope }
      : input.excludeScope
        ? { scopeKey: { not: input.excludeScope } }
        : {}),
    ...(and.length ? { AND: and } : {}),
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
                    verification: "VERIFIED",
                    AND: constraints.map((constraint) => ({
                      constraints: { some: constraint },
                    })),
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
  const input = normalizeShopCatalogProjectionQuery(await withCategoryGroupMode(raw));
  const projectionSql =
    buildShopCatalogProjectionOrderedQuerySql(input) ??
    buildShopCatalogProjectionVehicleQuerySql(input);
  const rows = projectionSql
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
          categoryGroupKey: string | null;
          productTypeKey: string | null;
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
      >(projectionSql)
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
          categoryGroupKey: true,
          productTypeKey: true,
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
  const visible = rows.slice(0, input.limit).map(({ categoryGroupKey, ...row }) => ({
    ...row,
    // Products without an admin category still show their storefront group.
    categoryLabel: row.categoryLabel ?? categoryGroupLabel(categoryGroupKey, input.locale),
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
    nextCursor:
      last &&
      hasMore &&
      input.order === "default" &&
      !input.text &&
      !input.priorityProductIds?.length &&
      !vehicleLowerTierApplies(input)
        ? { stableRank: last.stableRank, productId: last.productId }
        : null,
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
