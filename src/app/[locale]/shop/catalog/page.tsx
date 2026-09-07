import { connection } from "next/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ComponentProps } from "react";

import {
  queryShopCatalogProjection,
  queryShopCatalogProjectionFacets,
} from "@/lib/shopCatalogProjectionQuery.server";
import {
  resolveShopCatalogReaderFlag,
  isShopCatalogReaderRequestEnabled,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";
import {
  parseShopCatalogStorefrontQuery,
  type CatalogSearchParams,
} from "@/lib/shopCatalogStorefrontQuery";
import { canUsePremiumCatalogProjection } from "@/lib/shopCatalogPremiumEligibility";
import { resolveLocale } from "@/lib/seo";
import { observeShopCatalogRead } from "@/lib/shopCatalogReadTelemetry";
import { getShopCatalogCardPricingByIds } from "@/lib/shopCatalogCardPricing.server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { prisma } from "@/lib/prisma";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { buildShopCatalogEffectivePriceContext } from "@/lib/shopCatalogEffectivePrice.server";
import {
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SLUGS,
} from "@/lib/shopWarehouseInventory";
import CatalogV2Server from "./CatalogV2Server";

export { generateMetadata } from "./metadata";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
};

function catalogParamValues(filters: CatalogSearchParams, key: string): readonly string[] {
  if ("getAll" in filters && typeof filters.getAll === "function") return filters.getAll(key);
  const raw = (filters as Readonly<Record<string, string | string[] | undefined>>)[key];
  return raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
}

function legacyCatalogHref(locale: string, filters: CatalogSearchParams) {
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "scope",
    "brand",
    "category",
    "make",
    "model",
    "generation",
    "chassis",
    "year",
    "engine",
    "fuel",
    "opfGpf",
    "stock",
    "productType",
    "productKind",
    "sort",
    "currency",
    "europePrice",
    "minPrice",
    "maxPrice",
    "strict",
    "facetMode",
    "country",
    "page",
    "limit",
    "afterRank",
    "afterProduct",
  ] as const) {
    for (const value of catalogParamValues(filters, key)) {
      if (value.length <= 320) params.append(key, value);
    }
  }
  const query = params.toString();
  return `/${locale}/shop/stock${query ? `?${query}` : ""}`;
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
  const requestHeaders = reader.mode === "canary" ? await headers() : null;
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  if (
    !isShopCatalogReaderRequestEnabled(
      reader,
      requestHeaders?.get(SHOP_CATALOG_CANARY_REQUEST_HEADER)
    )
  ) {
    // Normal requests are internally rewritten by next.config. This is a
    // fail-closed fallback for direct route-module invocation only.
    redirect(legacyCatalogHref(locale, filters));
  }

  // The projection DTO contains some URL dimensions for transport and link
  // continuity even though their native semantics are not published yet.
  // Gate those requests before parsing/defaulting can turn them into a
  // projection no-op (product type/kind, strict, global facets, and OR brands).
  const eligibilityParams = {
    get: (name: string) => catalogParamValues(filters, name)[0] ?? null,
    getAll: (name: string) => [...catalogParamValues(filters, name)],
  };
  if (!canUsePremiumCatalogProjection(eligibilityParams)) {
    redirect(legacyCatalogHref(locale, filters));
  }

  // Opt into request-time rendering only for the explicit V2 reader. The
  // flag-off legacy branch remains eligible for its existing static caching.
  await connection();
  const resolvedLocale = resolveLocale(locale);
  const query = parseShopCatalogStorefrontQuery(resolvedLocale, filters);
  let renderProps: ComponentProps<typeof CatalogV2Server> | undefined;
  try {
    const warehouseProductsPromise =
      query.stock === "all"
        ? Promise.resolve([] as Array<{ id: string }>)
        : prisma.shopProduct.findMany({
            where: {
              isPublished: true,
              status: "ACTIVE",
              OR: [
                ...SHOP_WAREHOUSE_IN_STOCK_SKUS.flatMap((sku) => [
                  { sku: { equals: sku, mode: "insensitive" as const } },
                  {
                    variants: {
                      some: { sku: { equals: sku, mode: "insensitive" as const } },
                    },
                  },
                ]),
                { slug: { in: [...SHOP_WAREHOUSE_IN_STOCK_SLUGS] } },
              ],
            },
            select: { id: true },
          });
    const [settingsRecord, session, warehouseProducts] = await Promise.all([
      getOrCreateShopSettings(prisma),
      getCurrentShopCustomerSession(),
      warehouseProductsPromise,
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
    const pricingContext = await buildShopViewerPricingContextServer({
      prisma,
      settings,
      customerId: session?.customerId,
      customerGroup: session?.group,
      isAuthenticated: Boolean(session),
      customerB2BDiscountPercent: session?.b2bDiscountPercent,
      priceCountry: query.country,
    });
    const effectivePriceContext = buildShopCatalogEffectivePriceContext({
      viewer: pricingContext,
      currency: query.priceCurrency,
      currencyRates: settings.currencyRates,
    });
    const warehouseProductIds = warehouseProducts.map((product) => product.id);
    const projectionQuery = {
      ...query,
      effectivePriceContext,
      ...(query.stock === "inStock"
        ? { productIds: warehouseProductIds }
        : query.stock === "preOrder"
          ? { excludeProductIds: warehouseProductIds }
          : {}),
    };
    const [listingRead, facetRead] = await Promise.all([
      observeShopCatalogRead({
        operation: "listing",
        locale: resolvedLocale,
        filters: projectionQuery,
        databaseQueriesUpperBound: 1,
        rows: (value) => value.items.length,
        execute: () => queryShopCatalogProjection(projectionQuery),
      }),
      observeShopCatalogRead({
        operation: "facets",
        locale: resolvedLocale,
        filters: projectionQuery,
        databaseQueriesUpperBound: 1,
        rows: (value) => Object.values(value.facets).reduce((sum, rows) => sum + rows.length, 0),
        execute: () => queryShopCatalogProjectionFacets(projectionQuery),
      }),
    ]);
    const result = listingRead.value;
    const facetResult = facetRead.value;
    // Projection rows keep discovery fast, while this single bounded canonical
    // read makes admin price edits visible immediately and preserves regional /
    // B2B bands that deliberately do not belong in the public search index.
    const pricingRead = await observeShopCatalogRead({
      operation: "pricing",
      locale: resolvedLocale,
      filters: projectionQuery,
      // Canonical products (1); settings and viewer discount maps were resolved
      // before listing/facet reads so their effective price SQL is request-correct.
      databaseQueriesUpperBound: 1,
      rows: (value) => value.canonicalProducts.length,
      execute: async () => {
        const canonicalProducts = await getShopCatalogCardPricingByIds(
          result.items.map((item) => item.productId)
        );
        return { canonicalProducts, pricingContext };
      },
    });
    const { canonicalProducts } = pricingRead.value;
    const cardPrices = Object.fromEntries(
      canonicalProducts.map((product) => [
        product.productId,
        {
          price: product.price,
          europePrice: product.europePrice ?? null,
          b2bPrice: product.b2bPrice ?? null,
          compareAt: product.compareAt ?? null,
          b2bCompareAt: product.b2bCompareAt ?? null,
          brand: product.brand,
        },
      ])
    );

    renderProps = {
      locale: resolvedLocale,
      result,
      facets: facetResult.facets,
      query,
      cardPrices,
      pricingContext,
    };
  } catch (error) {
    if (reader.mode !== "canary") throw error;
    console.error({
      event: "catalog_v2_canary_fallback",
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    redirect(legacyCatalogHref(locale, filters));
  }

  if (!renderProps) throw new Error("Catalog V2 render props were not prepared");
  return <CatalogV2Server {...renderProps} />;
}
