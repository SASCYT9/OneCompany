import { SHOP_SEARCH_QUERY_MAX_LENGTH } from "./shopSearch";
import "server-only";

import {
  Prisma,
  ShopCatalogCompatibilityDimension,
  ShopCatalogConstraintState,
} from "@prisma/client";

import { prisma } from "./prisma";
import { resolveLegacyVehicleProductIds } from "./shopCatalogLegacyVehicleIds.server";
import {
  buildShopCatalogProjectionVehicleCondition,
  queryShopCatalogProjectionFacets,
} from "./shopCatalogProjectionQuery.server";
import { buildShopCatalogVehicleSearchPlan } from "./shopCatalogVehicleSearchPlan";
import {
  canonicalizeShopSearchQuery,
  matchesShopSearchQuery,
  normalizeShopSearchText,
  tokenizeShopSearchQuery,
} from "./shopSearch";
import { shopSearchTokenConditionSql } from "./shopSearchSql";
import { buildShopStorefrontProductPath } from "./shopStorefrontRouting";
import { getProductDisplayBrand } from "./shopProductDisplayBrand";
import {
  compactShopCode,
  expandVehicleAliases,
  getVehicleResidualSearchTokens,
} from "./shopVehicleSearch";

export const SHOP_CATALOG_SUGGESTION_LIMITS = Object.freeze({
  queryMin: 2,
  queryMax: SHOP_SEARCH_QUERY_MAX_LENGTH,
  total: 10,
  products: 6,
  brands: 2,
  vehicles: 2,
});

export type ShopCatalogSuggestion =
  | {
      type: "product";
      id: string;
      name: string;
      brand: string;
      partNumber: string;
      thumbnail: string | null;
      slug: string;
      href: string;
      category: string | null;
    }
  | { type: "brand"; id: string; label: string; count: number }
  | {
      type: "vehicle";
      id: string;
      label: string;
      make: string;
      model?: string;
      count: number;
    };

export type ShopCatalogSuggestionInput = {
  locale: "ua" | "en";
  query: string;
  scope?: string | null;
};

export function getShopCatalogSuggestionVehicleConstraints(query: string) {
  const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams({ q: query }), {
    readerMode: "projection",
  });
  const { make, model, generation, year, engine, fuel, opfGpf } = plan.constraints;
  if (!make || (!model && !generation)) return null;
  return { make, model, generation, year, engine, fuel, opfGpf };
}

export function getShopCatalogSuggestionTextQuery(query: string) {
  if (!getShopCatalogSuggestionVehicleConstraints(query)) return query;
  const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams({ q: query }), {
    readerMode: "projection",
  });
  const expansion = expandVehicleAliases(query);
  const queryTokens = new Set(tokenizeShopSearchQuery(canonicalizeShopSearchQuery(query)));
  const explicitSoftTerms = expansion.softTerms.filter((term) => {
    const tokens = tokenizeShopSearchQuery(canonicalizeShopSearchQuery(term));
    return tokens.length > 0 && tokens.every((token) => queryTokens.has(token));
  });
  return [
    ...new Set([
      ...getVehicleResidualSearchTokens(expansion),
      ...plan.qualifierTerms,
      ...explicitSoftTerms,
    ]),
  ].join(" ");
}

export function normalizeShopCatalogSuggestionInput(input: ShopCatalogSuggestionInput) {
  const query = input.query.trim();
  if (query.length < SHOP_CATALOG_SUGGESTION_LIMITS.queryMin) {
    return {
      locale: input.locale,
      query: "",
      normalizedQuery: "",
      normalizedSku: "",
      scope: null,
    } as const;
  }
  if (query.length > SHOP_CATALOG_SUGGESTION_LIMITS.queryMax) {
    throw new TypeError(`query exceeds ${SHOP_CATALOG_SUGGESTION_LIMITS.queryMax} characters`);
  }
  const canonicalQuery = canonicalizeShopSearchQuery(query);
  const scope = input.scope?.trim() || null;
  if (scope && scope.length > 64) throw new TypeError("scope exceeds 64 characters");
  return {
    locale: input.locale,
    query,
    normalizedQuery: normalizeShopSearchText(canonicalQuery),
    normalizedSku: compactShopCode(query),
    scope,
  };
}

function escapeLike(value: string) {
  return value.replace(/([\\%_])/g, "\\$1");
}

type SuggestionProductRow = {
  productId: string;
  slug: string;
  title: string;
  brandKey: string;
  brandLabel: string;
  categoryLabel: string | null;
  normalizedSku: string | null;
  primaryMediaUrl: string | null;
};

export function collectShopCatalogVehicleSuggestions(
  rows: Array<{
    productId: string;
    targetKey: string;
    clauseKey: string;
    dimension: ShopCatalogCompatibilityDimension;
    textValue: string | null;
  }>,
  normalizedQuery: string
) {
  const clauses = new Map<string, { productId: string; makes: Set<string>; models: Set<string> }>();
  for (const row of rows) {
    if (!row.textValue) continue;
    const key = `${row.productId}\u0000${row.targetKey}\u0000${row.clauseKey}`;
    const clause = clauses.get(key) ?? {
      productId: row.productId,
      makes: new Set<string>(),
      models: new Set<string>(),
    };
    if (row.dimension === ShopCatalogCompatibilityDimension.MAKE) {
      clause.makes.add(row.textValue);
    } else if (row.dimension === ShopCatalogCompatibilityDimension.MODEL) {
      clause.models.add(row.textValue);
    }
    clauses.set(key, clause);
  }

  const matches = new Map<string, { make: string; model?: string; products: Set<string> }>();
  const add = (label: string, make: string, model: string | undefined, productId: string) => {
    // Keep vehicle suggestions consistent with projection product matching:
    // query token order is presentation-only (`M5 BMW` still means BMW M5),
    // while code-like tokens remain exact in `matchesShopSearchQuery`.
    if (!matchesShopSearchQuery(label, normalizedQuery)) return;
    const key = normalizeShopSearchText(label);
    const current = matches.get(key) ?? { make, model, products: new Set<string>() };
    current.products.add(productId);
    matches.set(key, current);
  };
  for (const clause of clauses.values()) {
    for (const make of clause.makes) {
      add(make, make, undefined, clause.productId);
      for (const model of clause.models) add(`${make} ${model}`, make, model, clause.productId);
    }
  }
  return [...matches.entries()]
    .map(([key, value]) => ({
      type: "vehicle" as const,
      id: `vehicle:${key}`,
      label: value.model ? `${value.make} ${value.model}` : value.make,
      make: value.make,
      ...(value.model ? { model: value.model } : {}),
      count: value.products.size,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "en"))
    .slice(0, SHOP_CATALOG_SUGGESTION_LIMITS.vehicles);
}

export function normalizeShopCatalogBrandSuggestionRows(
  rows: ReadonlyArray<{ valueKey: string; valueLabel: string; productCount: number }>
): Array<Extract<ShopCatalogSuggestion, { type: "brand" }>> {
  const byDisplayBrand = new Map<string, { id: string; label: string; count: number }>();
  for (const row of rows) {
    const label = getProductDisplayBrand(row.valueLabel || row.valueKey);
    if (!label) continue;
    const key = normalizeShopSearchText(label);
    const current = byDisplayBrand.get(key);
    byDisplayBrand.set(key, {
      id: `brand:${key}`,
      label,
      count: (current?.count ?? 0) + row.productCount,
    });
  }
  return [...byDisplayBrand.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "en"))
    .slice(0, SHOP_CATALOG_SUGGESTION_LIMITS.brands)
    .map((brand) => ({ type: "brand" as const, ...brand }));
}

export async function queryShopCatalogSuggestions(
  raw: ShopCatalogSuggestionInput
): Promise<readonly ShopCatalogSuggestion[]> {
  const input = normalizeShopCatalogSuggestionInput(raw);
  if (!input.query) return Object.freeze([]);
  const prefixPattern = `${escapeLike(input.normalizedQuery)}%`;
  const vehicleSearchPlan = buildShopCatalogVehicleSearchPlan(
    new URLSearchParams({ q: input.query }),
    { readerMode: process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE }
  );
  const vehicleConstraints = getShopCatalogSuggestionVehicleConstraints(input.query);
  const vehicleProductIds = vehicleConstraints && !vehicleSearchPlan.canonical
    ? await resolveLegacyVehicleProductIds(vehicleSearchPlan.constraints)
    : null;
  const productQuery = getShopCatalogSuggestionTextQuery(input.query);
  const normalizedProductQuery = normalizeShopSearchText(
    canonicalizeShopSearchQuery(productQuery)
  );
  const normalizedProductSku = compactShopCode(normalizedProductQuery);
  const productSearchPattern = `%${escapeLike(normalizedProductQuery)}%`;
  // Match the same bounded token semantics as the stock search endpoint.
  // A contiguous phrase is too strict for reordered vehicle queries (for
  // example, `G90 BMW M5`), while an unconstrained OR would surface unrelated
  // products. Exact normalized SKUs remain a separate high-priority match.
  const queryTokens = tokenizeShopSearchQuery(normalizedProductQuery);
  const tokenConditions = queryTokens.map((token) =>
    shopSearchTokenConditionSql(Prisma.sql`projection."searchText"`, token)
  );
  const lexicalCondition =
    tokenConditions.length > 0
      ? Prisma.sql`(
          lower(coalesce(projection."normalizedSku", '')) = lower(${normalizedProductSku})
          OR (${Prisma.join(tokenConditions, " AND ")})
        )`
      : normalizedProductQuery
        ? Prisma.sql`projection."searchText" ILIKE ${productSearchPattern} ESCAPE '\\'`
        : Prisma.sql`TRUE`;
  const projectionConditions: Prisma.Sql[] = [
    Prisma.sql`projection."locale" = ${input.locale}`,
    Prisma.sql`projection."isPublished" = true`,
    Prisma.sql`projection."statusKey" = 'ACTIVE'`,
    lexicalCondition,
  ];
  if (input.scope) projectionConditions.push(Prisma.sql`projection."scopeKey" = ${input.scope}`);
  if (vehicleConstraints) {
    if (vehicleProductIds !== null) {
      projectionConditions.push(
        vehicleProductIds.length
          ? Prisma.sql`projection."productId" IN (${Prisma.join(vehicleProductIds)})`
          : Prisma.sql`FALSE`
      );
    } else {
      const vehicleCondition = buildShopCatalogProjectionVehicleCondition({
        locale: input.locale,
        ...vehicleConstraints,
      });
      if (vehicleCondition) projectionConditions.push(vehicleCondition);
    }
  }

  const [products, brands] = await Promise.all([
    prisma.$queryRaw<SuggestionProductRow[]>(Prisma.sql`
      SELECT projection."productId", projection."slug", projection."title",
             projection."brandKey", projection."brandLabel", projection."categoryLabel",
             projection."normalizedSku", projection."primaryMediaUrl"
      FROM "ShopCatalogProjection" projection
      WHERE ${Prisma.join(projectionConditions, " AND ")}
      ORDER BY
        CASE
          WHEN lower(coalesce(projection."normalizedSku", '')) = lower(${input.normalizedSku}) THEN 0
          WHEN lower(projection."title") = lower(${input.query}) THEN 1
          WHEN projection."title" ILIKE ${prefixPattern} ESCAPE '\\' THEN 2
          WHEN projection."brandLabel" ILIKE ${prefixPattern} ESCAPE '\\' THEN 3
          ELSE 4
        END,
        projection."stableRank" ASC,
        projection."productId" ASC
      LIMIT ${SHOP_CATALOG_SUGGESTION_LIMITS.products}`),
    vehicleConstraints
      ? queryShopCatalogProjectionFacets(
          vehicleProductIds !== null
            ? {
                locale: input.locale,
                scope: input.scope,
                productIds: vehicleProductIds,
                text: normalizedProductQuery || null,
              }
            : {
                locale: input.locale,
                scope: input.scope,
                text: normalizedProductQuery || null,
                ...vehicleConstraints,
              }
        ).then(({ facets }) =>
          facets.brand.map((brand) => ({
            valueKey: brand.key,
            valueLabel: brand.label,
            productCount: brand.count,
          }))
        )
      : prisma.shopCatalogProjectionFacetCount.findMany({
          where: {
            locale: input.locale,
            dimension: "BRAND",
            prefixKey: input.scope ? `scope:${input.scope}` : "",
            productCount: { gt: 0 },
            OR: [
              { valueKey: { contains: input.normalizedQuery, mode: "insensitive" } },
              { valueLabel: { contains: input.query, mode: "insensitive" } },
            ],
          },
          orderBy: [{ productCount: "desc" }, { valueLabel: "asc" }],
          take: SHOP_CATALOG_SUGGESTION_LIMITS.brands * 3,
        }),
  ]);

  const constraintRows = products.length
    ? await prisma.shopCatalogProjectionConstraint.findMany({
        where: {
          productId: { in: products.map((row) => row.productId) },
          dimension: {
            in: [ShopCatalogCompatibilityDimension.MAKE, ShopCatalogCompatibilityDimension.MODEL],
          },
          state: ShopCatalogConstraintState.EXACT,
          textValue: { not: null },
          clause: { verification: "VERIFIED" },
        },
        select: {
          productId: true,
          targetKey: true,
          clauseKey: true,
          dimension: true,
          textValue: true,
        },
      })
    : [];

  const brandSuggestions = normalizeShopCatalogBrandSuggestionRows(brands);
  const vehicleSuggestions = collectShopCatalogVehicleSuggestions(
    constraintRows,
    input.normalizedQuery
  );
  const productSuggestions: ShopCatalogSuggestion[] = products.map((product) => ({
    type: "product",
    id: product.productId,
    name: product.title,
    brand: getProductDisplayBrand(product.brandLabel || product.brandKey),
    partNumber: product.normalizedSku ?? "",
    thumbnail: product.primaryMediaUrl,
    slug: product.slug,
    href: buildShopStorefrontProductPath(input.locale, {
      slug: product.slug,
      brand: getProductDisplayBrand(product.brandLabel || product.brandKey),
    }),
    category: product.categoryLabel,
  }));
  return Object.freeze(
    [...brandSuggestions, ...vehicleSuggestions, ...productSuggestions].slice(
      0,
      SHOP_CATALOG_SUGGESTION_LIMITS.total
    )
  );
}
