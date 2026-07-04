import { NextRequest, NextResponse } from "next/server";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import {
  extractProductFitment,
  areChassisCompatible,
  isExpectedChassisForMakeModel,
  type Fitment,
} from "@/lib/crossShopFitment";
import { prisma } from "@/lib/prisma";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
} from "@/lib/shopPricingAudience";
import {
  buildShopSearchText,
  tokenizeShopSearchQuery,
  normalizeShopSearchText,
} from "@/lib/shopSearch";
import {
  buildVehicleSearchDebug,
  compactShopCode,
  expandVehicleAliases,
  isStructuredPartQuery,
  scoreVehicleSearchItem,
  type ShopVehicleSearchExpansion,
} from "@/lib/shopVehicleSearch";
import {
  getShopStockCategoryLabelForProduct,
  matchesShopStockCategory,
} from "@/lib/shopStockTaxonomy";
import { expandShopPrices } from "@/lib/shopPriceConversion";

const URBAN_VEHICLE_BRANDS = new Set([
  "land rover",
  "lamborghini",
  "rolls-royce",
  "mercedes-benz",
  "audi",
  "range rover",
  "bentley",
  "volkswagen",
  "urban",
  "urban automotive",
]);

type StockSearchSort = "default" | "price_asc" | "price_desc" | "name_asc";
type StockSearchStock = "all" | "inStock" | "preOrder";

const STOCK_SEARCH_SORTS = new Set<StockSearchSort>([
  "default",
  "price_asc",
  "price_desc",
  "name_asc",
]);

const STOCK_SEARCH_STATES = new Set<StockSearchStock>(["all", "inStock", "preOrder"]);
const DEFAULT_STOCK_SEARCH_LIMIT = 24;
const MAX_STOCK_SEARCH_LIMIT = 96;

export function getProductDisplayBrand(brand: string | null | undefined): string {
  if (!brand) return "";
  const lower = brand.trim().toLowerCase();
  if (URBAN_VEHICLE_BRANDS.has(lower)) {
    return "Urban Automotive";
  }
  return brand.trim();
}

let cachedProductsWithFitment: Array<{
  product: any;
  fitment: Fitment;
  searchText: string;
  titleText: string;
  skuText: string;
  compactSkuText: string;
  fitmentText: string;
}> | null = null;
let cachedTimestamp = 0;

export async function getShopProductsWithFitments() {
  const now = Date.now();
  const products = await getShopProductsServer();

  if (
    !cachedProductsWithFitment ||
    products.length !== cachedProductsWithFitment.length ||
    now - cachedTimestamp > 5 * 60 * 1000
  ) {
    cachedProductsWithFitment = products.map((product) => {
      const fitment = extractProductFitment(product);
      const displayBrand = getProductDisplayBrand(product.brand);
      const titleText = buildShopSearchText([product.title?.en, product.title?.ua]);
      const skuText = buildShopSearchText([
        product.sku,
        ...(product.variants ?? []).flatMap((variant: any) => [variant.sku, variant.title]),
      ]);
      const compactSkuText = [
        product.sku,
        ...(product.variants ?? []).map((variant: any) => variant.sku),
      ]
        .map((value) => compactShopCode(value))
        .filter(Boolean)
        .join(" ");
      const fitmentText = buildShopSearchText([
        fitment.make,
        ...fitment.models,
        ...fitment.chassisCodes,
      ]);

      const searchText = buildShopSearchText([
        product.title?.en,
        product.title?.ua,
        product.sku,
        product.slug,
        displayBrand,
        product.vendor,
        product.productType,
        product.category?.ua,
        product.category?.en,
        product.collection?.ua,
        product.collection?.en,
        product.shortDescription?.ua,
        product.shortDescription?.en,
        product.longDescription?.ua,
        product.longDescription?.en,
        ...(product.highlights ?? []).flatMap((item: any) => [item.ua, item.en]),
        ...(product.collections ?? []).flatMap((item: any) => [
          item.handle,
          item.title?.ua,
          item.title?.en,
          item.brand,
        ]),
        ...(product.variants ?? []).flatMap((variant: any) => [
          variant.sku,
          variant.title,
          variant.optionValues?.join(" "),
        ]),
        fitment.make,
        ...fitment.models,
        ...fitment.chassisCodes,
        ...(product.tags ?? []),
      ]);

      return {
        product,
        fitment,
        searchText,
        titleText,
        skuText,
        compactSkuText,
        fitmentText,
      };
    });
    cachedTimestamp = now;
  }

  return cachedProductsWithFitment;
}

function computeRelevanceScoreWithReasons(
  item: {
    searchText: string;
    titleText: string;
    skuText: string;
    compactSkuText: string;
    fitmentText: string;
  },
  queryTokens: string[],
  rawQuery: string,
  expandedQuery: ShopVehicleSearchExpansion,
  brand?: string,
  titleEn?: string,
  titleUa?: string
) {
  const vehicleScore = scoreVehicleSearchItem(item, expandedQuery);
  const compactQuery = compactShopCode(rawQuery);
  if (isStructuredPartQuery(rawQuery) && item.compactSkuText.includes(compactQuery)) {
    return { score: 1000, reasons: ["sku:exact"] };
  }

  let score = 0;
  let matchedTokens = 0;
  const normalizedBrand = normalizeShopSearchText(brand);
  const normalizedTitleEn = normalizeShopSearchText(titleEn);
  const normalizedTitleUa = normalizeShopSearchText(titleUa);

  for (const token of queryTokens) {
    if (!item.searchText.includes(token)) {
      continue;
    }

    matchedTokens += 1;
    score += 1.0;

    if (item.fitmentText.includes(token)) {
      score += 3.0;
    }
    if (
      item.titleText.includes(token) ||
      normalizedTitleEn.includes(token) ||
      normalizedTitleUa.includes(token)
    ) {
      score += 1.5;
    }
    if (item.skuText.includes(token)) {
      score += 2.0;
    }
    if (normalizedBrand.includes(token)) {
      score += 1.0;
    }
  }

  if (matchedTokens === 0) {
    return vehicleScore.score > 0 ? vehicleScore : { score: 0, reasons: [] };
  }

  const coverage = matchedTokens / queryTokens.length;

  // For multi-token vehicle/SKU searches, avoid ranking one-token coincidences
  // above real fitment matches. The fallback path still broadens when strict
  // filters produce no results.
  if (queryTokens.length >= 2 && coverage < 0.5) {
    return vehicleScore.score > 0 ? vehicleScore : { score: 0, reasons: [] };
  }

  const textScore = score * coverage;
  if (vehicleScore.score > 0) {
    return {
      score: vehicleScore.score + textScore,
      reasons: [...vehicleScore.reasons, `text:${textScore.toFixed(2)}`].slice(0, 8),
    };
  }
  return { score: textScore, reasons: [`text:${textScore.toFixed(2)}`] };
}

function narrowVehicleSearchResults<T extends { searchText: string; score: number }>(
  items: T[],
  expandedQuery: ShopVehicleSearchExpansion
) {
  if (expandedQuery.intent !== "vehicle" && expandedQuery.intent !== "mixed") {
    return items;
  }

  let narrowed = items;

  if (expandedQuery.requiredTokens.length > 0) {
    const fullRequiredMatches = items.filter((item) =>
      expandedQuery.requiredTokens.every((token) => item.searchText.includes(token))
    );
    const partialRequiredMatches = items.filter((item) =>
      expandedQuery.requiredTokens.some((token) => item.searchText.includes(token))
    );
    if (fullRequiredMatches.length > 0) {
      narrowed = fullRequiredMatches;
    } else if (partialRequiredMatches.length > 0) {
      narrowed = partialRequiredMatches;
    }
  }

  const minimumScore = expandedQuery.requiredTokens.length > 0 ? 12 : 8;
  const strongMatches = narrowed.filter((item) => item.score >= minimumScore);
  return strongMatches.length > 0 ? strongMatches : narrowed;
}

function parseStockSearchSort(value: string | null): StockSearchSort {
  return value && STOCK_SEARCH_SORTS.has(value as StockSearchSort)
    ? (value as StockSearchSort)
    : "default";
}

function parseStockSearchStock(value: string | null): StockSearchStock {
  return value && STOCK_SEARCH_STATES.has(value as StockSearchStock)
    ? (value as StockSearchStock)
    : "all";
}

function parseStockSearchLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STOCK_SEARCH_LIMIT;
  return Math.min(MAX_STOCK_SEARCH_LIMIT, Math.max(1, Math.floor(parsed)));
}

function hasAnyShopMoney(
  price: { eur?: number | null; usd?: number | null; uah?: number | null } | null | undefined
) {
  return (price?.eur ?? 0) > 0 || (price?.usd ?? 0) > 0 || (price?.uah ?? 0) > 0;
}

function incrementCount(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim();
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function buildFilterStats(
  productsWithFitments: Awaited<ReturnType<typeof getShopProductsWithFitments>>,
  locale: string
) {
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  let inStock = 0;
  let preOrder = 0;

  for (const item of productsWithFitments) {
    incrementCount(brands, getProductDisplayBrand(item.product.brand));
    incrementCount(categories, getShopStockCategoryLabelForProduct(item, locale));

    if (item.product.stock === "inStock") {
      inStock += 1;
    } else {
      preOrder += 1;
    }
  }

  const byCountThenLabel = (
    left: { label: string; count: number },
    right: { label: string; count: number }
  ) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.label.localeCompare(right.label, locale === "ua" ? "uk" : "en");
  };

  return {
    brands: Array.from(brands, ([label, count]) => ({ label, count })).sort(byCountThenLabel),
    categories: Array.from(categories, ([label, count]) => ({ label, count })).sort(
      byCountThenLabel
    ),
    stock: {
      all: productsWithFitments.length,
      inStock,
      preOrder,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const brand = searchParams.get("brand")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const make = searchParams.get("make")?.trim() || "";
    const model = searchParams.get("model")?.trim() || "";
    const chassis = searchParams.get("chassis")?.trim() || "";
    const stock = parseStockSearchStock(searchParams.get("stock"));
    const sort = parseStockSearchSort(searchParams.get("sort"));
    const locale = searchParams.get("locale")?.trim() || "ua";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const all = searchParams.get("all") === "true";
    const debug = searchParams.get("debug") === "true";
    const country = searchParams.get("country");
    const limit = parseStockSearchLimit(searchParams.get("limit"));

    const [settingsRecord, session, productsWithFitments] = await Promise.all([
      getOrCreateShopSettings(prisma),
      getCurrentShopCustomerSession(),
      getShopProductsWithFitments(),
    ]);

    const settings = getShopSettingsRuntime(settingsRecord);
    const pricingContext = buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null,
      undefined,
      { priceCountry: country }
    );

    const getProductPriceForSort = (product: any) => {
      const pricing = resolveShopProductPricing(product, pricingContext);
      if (pricing.effectivePrice.usd > 0) return pricing.effectivePrice.usd;
      const usdRate = settings.currencyRates.USD || 1.152174;
      const uahRate = settings.currencyRates.UAH || 53.0;
      if (pricing.effectivePrice.eur > 0) return pricing.effectivePrice.eur * usdRate;
      if (pricing.effectivePrice.uah > 0) return pricing.effectivePrice.uah / (uahRate / usdRate);
      return 0;
    };

    // 1. Filter logic
    let filtered = productsWithFitments;

    if (brand) {
      const brandNames = brand
        .split(",")
        .map((b) => b.trim().toLowerCase())
        .filter(Boolean);
      if (brandNames.length > 0) {
        filtered = filtered.filter((item) => {
          const displayBrand = getProductDisplayBrand(item.product.brand).toLowerCase();
          return brandNames.includes(displayBrand);
        });
      }
    }

    if (category) {
      filtered = filtered.filter((item) => matchesShopStockCategory(item, category, locale));
    }

    if (stock !== "all") {
      filtered = filtered.filter((item) => item.product.stock === stock);
    }

    if (make) {
      const makeNorm = normalizeShopSearchText(make);
      filtered = filtered.filter(
        (item) =>
          (item.fitment.make && normalizeShopSearchText(item.fitment.make) === makeNorm) ||
          item.searchText.includes(makeNorm)
      );
    }

    if (model) {
      const modelNorm = normalizeShopSearchText(model);
      filtered = filtered.filter(
        (item) =>
          item.fitment.models.some((m: string) => normalizeShopSearchText(m) === modelNorm) ||
          item.searchText.includes(modelNorm)
      );
    }

    if (chassis) {
      const chassisNorm = normalizeShopSearchText(chassis);
      if (make && model && !isExpectedChassisForMakeModel(make, model, chassis)) {
        filtered = [];
      } else {
        filtered = filtered.filter(
          (item) =>
            item.fitment.chassisCodes.some((c: string) =>
              areChassisCompatible(c, chassis.toUpperCase())
            ) || item.searchText.includes(chassisNorm)
        );
      }
    }

    // 2. Search query with relevance scoring
    const queryTokens = tokenizeShopSearchQuery(q);
    const expandedQuery = q ? expandVehicleAliases(q) : null;
    const compactQuery = compactShopCode(q);
    const structuredPartQuery = isStructuredPartQuery(q);
    let scoredItems = filtered.map((item) => {
      let score = 1;
      let scoreReasons: string[] = [];
      const displayBrand = getProductDisplayBrand(item.product.brand);
      if (q && queryTokens.length > 0) {
        const scored = computeRelevanceScoreWithReasons(
          item,
          queryTokens,
          q,
          expandedQuery!,
          displayBrand,
          item.product.title?.en,
          item.product.title?.ua
        );
        score = scored.score;
        scoreReasons = scored.reasons;
      }
      return { ...item, score, scoreReasons };
    });

    const sortByNameAsc = (
      left: (typeof scoredItems)[number],
      right: (typeof scoredItems)[number]
    ) => {
      const titleA =
        locale === "en"
          ? left.product.title.en || left.product.title.ua || ""
          : left.product.title.ua || left.product.title.en || "";
      const titleB =
        locale === "en"
          ? right.product.title.en || right.product.title.ua || ""
          : right.product.title.ua || right.product.title.en || "";
      return titleA.localeCompare(titleB, locale === "ua" ? "uk" : "en");
    };

    const sortByExplicitSort = (items: typeof scoredItems) => {
      if (sort === "price_asc") {
        items.sort((a, b) => getProductPriceForSort(a.product) - getProductPriceForSort(b.product));
        return;
      }
      if (sort === "price_desc") {
        items.sort((a, b) => getProductPriceForSort(b.product) - getProductPriceForSort(a.product));
        return;
      }
      if (sort === "name_asc") {
        items.sort(sortByNameAsc);
      }
    };

    if (q && queryTokens.length > 0) {
      // Keep only matches
      scoredItems = scoredItems.filter((item) => item.score > 0);
      if (structuredPartQuery) {
        const exactSkuMatches = scoredItems.filter((item) =>
          item.compactSkuText.includes(compactQuery)
        );
        if (exactSkuMatches.length > 0) {
          scoredItems = exactSkuMatches;
        } else if (expandedQuery) {
          scoredItems = narrowVehicleSearchResults(scoredItems, expandedQuery);
        }
      } else if (expandedQuery) {
        scoredItems = narrowVehicleSearchResults(scoredItems, expandedQuery);
      }
      // Sort by relevance score descending
      scoredItems.sort((a, b) => b.score - a.score);
      if (sort !== "default") {
        sortByExplicitSort(scoredItems);
      }
    } else if (sort !== "default") {
      sortByExplicitSort(scoredItems);
    } else if (brand) {
      // Sort by price descending if a brand filter is active (show premium kits first)
      scoredItems.sort((a, b) => {
        const priceA = getProductPriceForSort(a.product);
        const priceB = getProductPriceForSort(b.product);
        return priceB - priceA;
      });
    } else {
      // Default sorting: inStock first, then title
      scoredItems.sort((a, b) => {
        const stockA = a.product.stock === "inStock" ? 1 : 0;
        const stockB = b.product.stock === "inStock" ? 1 : 0;
        if (stockA !== stockB) return stockB - stockA;
        const titleA = a.product.title.ua || a.product.title.en || "";
        const titleB = b.product.title.ua || b.product.title.en || "";
        return titleA.localeCompare(titleB);
      });
    }

    let totalItems = scoredItems.length;
    let totalPages = Math.ceil(totalItems / limit);
    let paginatedItems = all ? scoredItems : scoredItems.slice((page - 1) * limit, page * limit);
    let fallbackApplied: "fitment" | "all" | null = null;

    if (totalItems === 0 && q && (make || model || chassis || brand)) {
      // Fallback 1: Ignore vehicle fitment filters
      let fallbackFiltered = productsWithFitments;
      if (brand) {
        const brandNames = brand
          .split(",")
          .map((b) => b.trim().toLowerCase())
          .filter(Boolean);
        fallbackFiltered = fallbackFiltered.filter((item) =>
          brandNames.includes(getProductDisplayBrand(item.product.brand).toLowerCase())
        );
      }
      if (stock !== "all") {
        fallbackFiltered = fallbackFiltered.filter((item) => item.product.stock === stock);
      }
      if (category) {
        fallbackFiltered = fallbackFiltered.filter((item) =>
          matchesShopStockCategory(item, category, locale)
        );
      }

      const fallbackScored = fallbackFiltered
        .map((item) => {
          const displayBrand = getProductDisplayBrand(item.product.brand);
          const scored = computeRelevanceScoreWithReasons(
            item,
            queryTokens,
            q,
            expandedQuery!,
            displayBrand,
            item.product.title?.en,
            item.product.title?.ua
          );
          return { ...item, score: scored.score, scoreReasons: scored.reasons };
        })
        .filter((item) => item.score > 0);
      if (expandedQuery) {
        fallbackScored.splice(
          0,
          fallbackScored.length,
          ...narrowVehicleSearchResults(fallbackScored, expandedQuery)
        );
      }

      fallbackScored.sort((a, b) => b.score - a.score);
      if (sort !== "default") {
        sortByExplicitSort(fallbackScored);
      }

      if (fallbackScored.length > 0) {
        fallbackApplied = "fitment";
        totalItems = fallbackScored.length;
        totalPages = Math.ceil(totalItems / limit);
        paginatedItems = fallbackScored.slice((page - 1) * limit, page * limit);
      } else if (brand) {
        // Fallback 2: Ignore brand/category as well (global query match)
        let globalSource = productsWithFitments;
        if (stock !== "all") {
          globalSource = globalSource.filter((item) => item.product.stock === stock);
        }
        const globalScored = globalSource
          .map((item) => {
            const displayBrand = getProductDisplayBrand(item.product.brand);
            const scored = computeRelevanceScoreWithReasons(
              item,
              queryTokens,
              q,
              expandedQuery!,
              displayBrand,
              item.product.title?.en,
              item.product.title?.ua
            );
            return { ...item, score: scored.score, scoreReasons: scored.reasons };
          })
          .filter((item) => item.score > 0);
        if (expandedQuery) {
          globalScored.splice(
            0,
            globalScored.length,
            ...narrowVehicleSearchResults(globalScored, expandedQuery)
          );
        }

        globalScored.sort((a, b) => b.score - a.score);
        if (sort !== "default") {
          sortByExplicitSort(globalScored);
        }

        if (globalScored.length > 0) {
          fallbackApplied = "all";
          totalItems = globalScored.length;
          totalPages = Math.ceil(totalItems / limit);
          paginatedItems = globalScored.slice((page - 1) * limit, page * limit);
        }
      }
    }

    // 3. Serialize output for frontend
    const sanitizedItems = paginatedItems.map(({ product, fitment }) => {
      const pricing = resolveShopProductPricing(product, pricingContext);

      const usdRate = settings.currencyRates.USD || 1.152174;
      const uahRate = settings.currencyRates.UAH || 53.0;

      const effectivePriceSet = expandShopPrices(pricing.effectivePrice, settings.currencyRates);

      const expandedEffectiveCompareAtSet = pricing.effectiveCompareAt
        ? expandShopPrices(pricing.effectiveCompareAt, settings.currencyRates)
        : null;
      const effectiveCompareAtSet = hasAnyShopMoney(expandedEffectiveCompareAtSet)
        ? expandedEffectiveCompareAtSet
        : null;

      const expandedB2cPriceSet = pricing.bands?.b2c?.price
        ? expandShopPrices(pricing.bands.b2c.price, settings.currencyRates)
        : null;
      const b2cCompareAtFallback = hasAnyShopMoney(expandedB2cPriceSet)
        ? expandedB2cPriceSet
        : null;

      const compareAtPriceSet = effectiveCompareAtSet ?? b2cCompareAtFallback;

      const dealerPrice =
        effectivePriceSet.usd > 0
          ? effectivePriceSet.usd
          : effectivePriceSet.eur > 0
            ? effectivePriceSet.eur * usdRate
            : effectivePriceSet.uah > 0
              ? effectivePriceSet.uah / (uahRate / usdRate)
              : 0;

      const msrp =
        compareAtPriceSet && compareAtPriceSet.usd > 0
          ? compareAtPriceSet.usd
          : compareAtPriceSet && compareAtPriceSet.eur > 0
            ? compareAtPriceSet.eur * usdRate
            : compareAtPriceSet && compareAtPriceSet.uah > 0
              ? compareAtPriceSet.uah / (uahRate / usdRate)
              : null;

      const defaultVariant =
        product.variants?.find((v: any) => v.isDefault) || product.variants?.[0];

      return {
        id: product.id,
        name:
          locale === "en"
            ? product.title.en || product.title.ua
            : product.title.ua || product.title.en,
        brand: getProductDisplayBrand(product.brand),
        partNumber: product.sku || "",
        description:
          locale === "en"
            ? product.shortDescription?.en || product.shortDescription?.ua || ""
            : product.shortDescription?.ua || product.shortDescription?.en || "",
        category:
          locale === "en"
            ? product.category?.en || product.category?.ua || ""
            : product.category?.ua || product.category?.en || "",
        thumbnail: product.image || null,
        inStock: product.stock === "inStock",
        price: dealerPrice,
        priceUsd: effectivePriceSet.usd,
        priceEur: effectivePriceSet.eur,
        priceUah: effectivePriceSet.uah,
        priceSet: effectivePriceSet,
        originalPrice: msrp,
        originalPriceSet: compareAtPriceSet,
        markupPct: pricing.discountPercent || 0,
        slug: product.slug,
        variantId: defaultVariant?.id || null,
        turn14Id: "", // empty so frontend knows it's a shop product
        source: "local" as const,
      };
    });

    const filterStats = buildFilterStats(productsWithFitments, locale);

    // Extract all unique brands and curated product groups for filter menus
    const brands = Array.from(
      new Set(
        productsWithFitments.map((p) => getProductDisplayBrand(p.product.brand)).filter(Boolean)
      )
    ).sort();
    const categories = filterStats.categories.map((entry) => entry.label);

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages,
        totalItems,
        source: "local",
        fallbackApplied,
        ...(debug && q
          ? {
              debug: {
                query: buildVehicleSearchDebug(expandedQuery ?? expandVehicleAliases(q)),
                topReasons: paginatedItems.slice(0, 10).map((item: any) => ({
                  slug: item.product.slug,
                  sku: item.product.sku,
                  score: item.score,
                  reasons: item.scoreReasons ?? [],
                })),
              },
            }
          : {}),
      },
      filters: {
        brands,
        categories,
      },
      filterStats,
    });
  } catch (error: any) {
    console.error("[Stock Search API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
