import "server-only";

import { NextResponse } from "next/server";

import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { getShopCatalogCardPricingByIds } from "@/lib/shopCatalogCardPricing.server";
import {
  countShopCatalogProjection,
  queryShopCatalogProjection,
  queryShopCatalogProjectionFacets,
  type ShopCatalogProjectionQueryInput,
} from "@/lib/shopCatalogProjectionQuery.server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { expandShopPrices } from "@/lib/shopPriceConversion";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPath } from "@/lib/shopStorefrontRouting";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 24;

const clean = (value: string | null, max = 320) => {
  const result = value?.trim() ?? "";
  return result && result.length <= max ? result : null;
};

const positiveInteger = (value: string | null, fallback: number) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

const firstBrand = (params: URLSearchParams) =>
  clean(
    params
      .getAll("brand")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .find(Boolean) ?? null
  );

/**
 * Adapter for the established premium catalog UI. It deliberately reads only
 * one bounded projection page and one bounded canonical price set; no product
 * descriptions, media galleries, metafields, or variants graph are loaded.
 */
export async function queryPremiumCatalogProjection(params: URLSearchParams) {
  const locale = params.get("locale") === "en" ? "en" : "ua";
  const page = positiveInteger(params.get("page"), 1);
  const requestedLimit = Math.min(96, positiveInteger(params.get("limit"), PAGE_SIZE));
  const yearText = clean(params.get("year"), 4);
  const year = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  const query: ShopCatalogProjectionQueryInput = {
    locale,
    limit: requestedLimit,
    text: clean(params.get("q"), 256),
    // The established UI uses `auto` as its default tab, while many canonical
    // automotive products intentionally have no explicit scope key. Vehicle
    // constraints already keep auto searches precise. Moto is an actual
    // catalog partition and must remain strict.
    scope: params.get("scope")?.trim().toLowerCase() === "moto" ? "moto" : null,
    brand: firstBrand(params),
    category: clean(params.get("category")),
    make: clean(params.get("make")),
    model: clean(params.get("model")),
    generation: clean(params.get("chassis") ?? params.get("generation")),
    year: year && year >= 1886 && year <= 2200 ? year : null,
    engine: clean(params.get("engine")),
    fuel: clean(params.get("fuel")),
  };

  let cursor: { stableRank: string; productId: string } | null = null;
  let result: Awaited<ReturnType<typeof queryShopCatalogProjection>> | null = null;
  const [firstPage, facetResult, totalItems] = await Promise.all([
    queryShopCatalogProjection(query),
    queryShopCatalogProjectionFacets(query),
    countShopCatalogProjection(query),
  ]);
  result = firstPage;
  cursor = firstPage.nextCursor;
  for (let currentPage = 2; currentPage <= page && result.hasMore; currentPage += 1) {
    result = await queryShopCatalogProjection({ ...query, after: cursor });
    cursor = result.nextCursor;
  }

  const [session, settingsRecord] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
  ]);
  const items = result?.items ?? [];
  const prices = await getShopCatalogCardPricingByIds(items.map((item) => item.productId));
  const settings = getShopSettingsRuntime(settingsRecord);
  const pricingContext = await buildShopViewerPricingContextServer({
    prisma,
    settings,
    customerId: session?.customerId,
    customerGroup: session?.group,
    isAuthenticated: Boolean(session),
    customerB2BDiscountPercent: session?.b2bDiscountPercent,
    priceCountry: params.get("country"),
  });
  const priceByProduct = new Map(prices.map((price) => [price.productId, price]));

  const data = items.map((item) => {
    const cardPrice = priceByProduct.get(item.productId);
    const pricing = cardPrice
      ? resolveShopProductPricing(cardPrice as never, pricingContext)
      : null;
    const priceSet = pricing
      ? expandShopPrices(pricing.effectivePrice, settings.currencyRates)
      : { eur: 0, usd: 0, uah: 0 };
    const compareAtSet = pricing?.effectiveCompareAt
      ? expandShopPrices(pricing.effectiveCompareAt, settings.currencyRates)
      : null;
    const usdRate = settings.currencyRates.USD || 1.152174;
    const uahRate = settings.currencyRates.UAH || 53;
    const displayPrice =
      priceSet.usd > 0
        ? priceSet.usd
        : priceSet.eur > 0
          ? priceSet.eur * usdRate
          : priceSet.uah > 0
            ? priceSet.uah / (uahRate / usdRate)
            : 0;
    return {
      id: item.productId,
      name: item.title,
      brand: item.brandLabel || item.brandKey,
      partNumber: item.normalizedSku ?? "",
      description: item.cardCopy ?? "",
      category: item.categoryLabel ?? "",
      thumbnail: cardPrice?.primaryMediaUrl ?? item.primaryMediaUrl ?? null,
      inStock: true,
      price: displayPrice,
      priceUsd: priceSet.usd,
      priceEur: priceSet.eur,
      priceUah: priceSet.uah,
      priceSet,
      originalPrice:
        compareAtSet?.usd ||
        (compareAtSet?.eur ? compareAtSet.eur * usdRate : 0) ||
        (compareAtSet?.uah ? compareAtSet.uah / (uahRate / usdRate) : null),
      originalPriceSet: compareAtSet,
      basePrice: displayPrice,
      markupPct: pricing?.discountPercent ?? 0,
      slug: item.slug,
      href: buildShopStorefrontProductPath(locale, {
        slug: item.slug,
        brand: item.brandLabel || item.brandKey,
      }),
      variantId: cardPrice?.defaultVariantId ?? null,
      turn14Id: "",
      source: "catalog_v2_projection" as const,
    };
  });

  const pricesOnPage = data.map((item) => item.price).filter((price) => price > 0);
  const filterStats = {
    brands: facetResult.facets.brand.map(({ label, count }) => ({ label, count })),
    categories: facetResult.facets.category.map(({ label, count }) => ({ label, count })),
    stock: { all: totalItems, inStock: totalItems, preOrder: 0 },
    price: {
      min: pricesOnPage.length ? Math.floor(Math.min(...pricesOnPage)) : 0,
      max: pricesOnPage.length ? Math.ceil(Math.max(...pricesOnPage)) : 0,
      currency: "USD",
    },
  };
  const response = NextResponse.json({
    data,
    meta: {
      page,
      totalPages: Math.max(1, Math.ceil(totalItems / requestedLimit)),
      totalItems,
      source: "catalog_v2_projection",
      fallbackApplied: null,
    },
    filters: {
      brands: filterStats.brands.map((item) => item.label),
      categories: filterStats.categories.map((item) => item.label),
      price: filterStats.price,
    },
    filterStats,
    globalFilterStats: filterStats,
  });
  response.headers.set(
    "Cache-Control",
    session ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300"
  );
  return response;
}
