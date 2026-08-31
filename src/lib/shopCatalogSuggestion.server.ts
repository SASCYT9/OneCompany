import "server-only";

import {
  Prisma,
  ShopCatalogCompatibilityDimension,
  ShopCatalogConstraintState,
} from "@prisma/client";

import { prisma } from "./prisma";
import { normalizeShopSearchText } from "./shopSearch";
import { buildShopStorefrontProductPath } from "./shopStorefrontRouting";
import { compactShopCode } from "./shopVehicleSearch";

export const SHOP_CATALOG_SUGGESTION_LIMITS = Object.freeze({
  queryMin: 2,
  queryMax: 64,
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
  const scope = input.scope?.trim() || null;
  if (scope && scope.length > 64) throw new TypeError("scope exceeds 64 characters");
  return {
    locale: input.locale,
    query,
    normalizedQuery: normalizeShopSearchText(query),
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
    if (!normalizeShopSearchText(label).includes(normalizedQuery)) return;
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

export async function queryShopCatalogSuggestions(
  raw: ShopCatalogSuggestionInput
): Promise<readonly ShopCatalogSuggestion[]> {
  const input = normalizeShopCatalogSuggestionInput(raw);
  if (!input.query) return Object.freeze([]);
  const searchPattern = `%${escapeLike(input.normalizedQuery)}%`;
  const prefixPattern = `${escapeLike(input.normalizedQuery)}%`;
  const projectionConditions: Prisma.Sql[] = [
    Prisma.sql`projection."locale" = ${input.locale}`,
    Prisma.sql`projection."isPublished" = true`,
    Prisma.sql`projection."statusKey" = 'ACTIVE'`,
    Prisma.sql`projection."searchText" ILIKE ${searchPattern} ESCAPE '\\'`,
  ];
  if (input.scope) projectionConditions.push(Prisma.sql`projection."scopeKey" = ${input.scope}`);

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
    prisma.shopCatalogProjectionFacetCount.findMany({
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
      take: SHOP_CATALOG_SUGGESTION_LIMITS.brands,
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

  const brandSuggestions: ShopCatalogSuggestion[] = brands.map((brand) => ({
    type: "brand",
    id: `brand:${brand.valueKey}`,
    label: brand.valueLabel,
    count: brand.productCount,
  }));
  const vehicleSuggestions = collectShopCatalogVehicleSuggestions(
    constraintRows,
    input.normalizedQuery
  );
  const productSuggestions: ShopCatalogSuggestion[] = products.map((product) => ({
    type: "product",
    id: product.productId,
    name: product.title,
    brand: product.brandLabel,
    partNumber: product.normalizedSku ?? "",
    thumbnail: product.primaryMediaUrl,
    slug: product.slug,
    href: buildShopStorefrontProductPath(input.locale, {
      slug: product.slug,
      brand: product.brandLabel || product.brandKey,
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
