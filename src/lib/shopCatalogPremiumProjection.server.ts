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
import { getKwCardTitle } from "@/lib/shopKwCardPresentation";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { expandShopPrices } from "@/lib/shopPriceConversion";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPath } from "@/lib/shopStorefrontRouting";
import { prisma } from "@/lib/prisma";
import { resolveLegacyVehicleProductIds } from "@/lib/shopCatalogLegacyVehicleIds.server";
import { isEuropePricingCountry } from "@/lib/shopEuropePricing";
import {
  isShopWarehouseInStockProduct,
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SLUGS,
} from "@/lib/shopWarehouseInventory";
import {
  EVENTURI_SHARED_V8_INTAKE_SLUG,
  EVENTURI_SHARED_V8_INTAKE_SLUGS,
  isEventuriSharedV8Intake,
  matchesEventuriSharedV8Application,
} from "@/lib/eventuriSharedIntake";
import { getProductDisplayBrand } from "@/lib/shopProductDisplayBrand";

const PAGE_SIZE = 24;

const clean = (value: string | null, max = 320) => {
  const result = value?.trim() ?? "";
  return result && result.length <= max ? result : null;
};

const positiveInteger = (value: string | null, fallback: number) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

const nonNegativeAmount = (value: string | null) => {
  if (!value?.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
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
  const startedAt = performance.now();
  const timings: string[] = [];
  async function measure<T>(name: string, operation: Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await operation;
    } finally {
      timings.push(`${name};dur=${(performance.now() - start).toFixed(1)}`);
    }
  }
  const locale = params.get("locale") === "en" ? "en" : "ua";
  const page = positiveInteger(params.get("page"), 1);
  const requestedLimit = Math.min(96, positiveInteger(params.get("limit"), PAGE_SIZE));
  const yearText = clean(params.get("year"), 4);
  const year = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  let minPrice = nonNegativeAmount(params.get("minPrice"));
  let maxPrice = nonNegativeAmount(params.get("maxPrice"));
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const requestedCurrency = params.get("currency")?.trim().toUpperCase();
  const priceCurrency =
    requestedCurrency === "EUR" || requestedCurrency === "UAH" ? requestedCurrency : "USD";
  const requestedSort = params.get("sort");
  const requestedStock = params.get("stock") === "inStock" ? "inStock" : null;
  const warehouseProductsPromise = measure(
    "warehouse",
    prisma.shopProduct.findMany({
      where: {
        isPublished: true,
        status: "ACTIVE",
        OR: [
          ...SHOP_WAREHOUSE_IN_STOCK_SKUS.flatMap((sku) => [
            { sku: { equals: sku, mode: "insensitive" as const } },
            { variants: { some: { sku: { equals: sku, mode: "insensitive" as const } } } },
          ]),
          { slug: { in: [...SHOP_WAREHOUSE_IN_STOCK_SLUGS] } },
        ],
      },
      select: { id: true, sku: true, slug: true },
    })
  );
  const [settingsRecord, warehouseProducts, session] = await Promise.all([
    measure("settings", getOrCreateShopSettings(prisma)),
    warehouseProductsPromise,
    measure("session", getCurrentShopCustomerSession()),
  ]);
  const settings = getShopSettingsRuntime(settingsRecord);
  const useEuropePrice = isEuropePricingCountry(params.get("country"));
  if (useEuropePrice) {
    const rate =
      priceCurrency === "USD"
        ? settings.currencyRates.USD || 1.152174
        : priceCurrency === "UAH"
          ? settings.currencyRates.UAH || 53
          : 1;
    minPrice = minPrice == null ? null : minPrice / rate;
    maxPrice = maxPrice == null ? null : maxPrice / rate;
  }
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
    minPrice,
    maxPrice,
    priceCurrency: useEuropePrice ? "EUR" : priceCurrency,
    useEuropePrice,
    offset: (page - 1) * requestedLimit,
  };
  const warehouseProductIds = warehouseProducts.map((product) => product.id);
  const sharedEventuriSlugs = new Set<string>(EVENTURI_SHARED_V8_INTAKE_SLUGS);
  const sharedEventuriProducts = warehouseProducts.filter(
    (product) => isEventuriSharedV8Intake(product.sku) || sharedEventuriSlugs.has(product.slug)
  );
  const canonicalSharedEventuriId = sharedEventuriProducts.find(
    (product) => product.slug === EVENTURI_SHARED_V8_INTAKE_SLUG
  )?.id;
  query.excludeProductIds = sharedEventuriProducts
    .filter((product) => product.id !== canonicalSharedEventuriId)
    .map((product) => product.id);
  if (requestedStock === "inStock") query.productIds = warehouseProductIds;

  const hasVehicleSelection = Boolean(query.make || query.model || query.generation || query.year);
  query.orderSeed = [
    query.make,
    query.model,
    query.generation,
    query.year,
    query.engine,
    query.fuel,
  ]
    .filter(Boolean)
    .join("|");
  query.order =
    requestedSort === "price_asc"
      ? "price_asc"
      : requestedSort === "price_desc"
        ? "price_desc"
        : requestedSort === "name_asc"
          ? "name_asc"
          : hasVehicleSelection
            ? "brand_interleave"
            : "default";

  // Until every historical brand is backfilled into compatibility policies,
  // preserve the complete product-owned vehicle coverage. Engine/fuel remain
  // projection-native because legacy evidence does not model them reliably.
  if (query.make || query.model || query.generation || query.year) {
    const vehicleProductIds = await measure(
      "vehicle",
      resolveLegacyVehicleProductIds({
        make: query.make,
        model: query.model,
        generation: query.generation,
        year: query.year,
      })
    );
    if (vehicleProductIds) {
      const effectiveVehicleProductIds =
        canonicalSharedEventuriId && matchesEventuriSharedV8Application(query.make, query.model)
          ? [...new Set([...vehicleProductIds, canonicalSharedEventuriId])]
          : vehicleProductIds;
      query.productIds = query.productIds
        ? effectiveVehicleProductIds.filter((productId) => query.productIds?.includes(productId))
        : effectiveVehicleProductIds;
    }
    query.make = null;
    query.model = null;
    query.generation = null;
    query.year = null;
  }

  const [result, facetResult, totalItems] = await Promise.all([
    measure("products", queryShopCatalogProjection(query)),
    measure("facets", queryShopCatalogProjectionFacets(query)),
    measure("count", countShopCatalogProjection(query)),
  ]);
  const items = result.items;
  const prices = await measure(
    "prices",
    getShopCatalogCardPricingByIds(items.map((item) => item.productId))
  );
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
    const displayBrand = getProductDisplayBrand(item.brandLabel || item.brandKey);
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
      name: getKwCardTitle({
        brand: displayBrand,
        title: item.title,
        locale,
      }),
      brand: displayBrand,
      partNumber: item.normalizedSku ?? "",
      description: item.cardCopy ?? "",
      category: item.categoryLabel ?? "",
      thumbnail: cardPrice?.primaryMediaUrl ?? item.primaryMediaUrl ?? null,
      inStock: isShopWarehouseInStockProduct(cardPrice?.sku ?? item.normalizedSku, item.slug),
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
        brand: displayBrand,
      }),
      variantId: cardPrice?.defaultVariantId ?? null,
      turn14Id: "",
      source: "catalog_v2_projection" as const,
    };
  });

  const pricesOnPage = data.map((item) => item.price).filter((price) => price > 0);
  const brandCounts = new Map<string, number>();
  for (const { label, count } of facetResult.facets.brand) {
    const displayBrand = getProductDisplayBrand(label);
    brandCounts.set(displayBrand, (brandCounts.get(displayBrand) ?? 0) + count);
  }
  const filterStats = {
    brands: [...brandCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    categories: facetResult.facets.category.map(({ label, count }) => ({ label, count })),
    stock: {
      all: totalItems,
      inStock: requestedStock === "inStock" ? totalItems : warehouseProductIds.length,
      preOrder:
        requestedStock === "inStock" ? 0 : Math.max(0, totalItems - warehouseProductIds.length),
    },
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
  response.headers.set(
    "Server-Timing",
    [...timings, `total;dur=${(performance.now() - startedAt).toFixed(1)}`].join(", ")
  );
  return response;
}
