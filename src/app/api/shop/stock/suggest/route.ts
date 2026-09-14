import { getShopSearchFallbackQuery } from "@/lib/shopSearchRecovery";
import { SHOP_SEARCH_QUERY_MAX_LENGTH } from "@/lib/shopSearch";
import { NextRequest, NextResponse } from "next/server";

import { getProductDisplayBrand, getShopProductsWithFitments } from "@/lib/shopStockSearch.server";
import { compactShopCode, parseVehicleSearchQuery } from "@/lib/shopVehicleSearch";
import {
  canonicalizeShopSearchQuery,
  matchesShopSearchQuery,
  matchesShopSearchToken,
  matchesShopSearchBrandIntent,
  normalizeShopSearchText,
  tokenizeShopSearchQuery,
} from "@/lib/shopSearch";
import {
  resolveShopCatalogReaderFlag,
  isShopCatalogReaderRequestEnabled,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";
import { queryShopCatalogSuggestions } from "@/lib/shopCatalogSuggestion.server";
import { observeShopCatalogRead, shopCatalogServerTiming } from "@/lib/shopCatalogReadTelemetry";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { getShopStockCategoryLabelForProduct } from "@/lib/shopStockTaxonomy";
import { shouldIncludeStockSuggestionMatch } from "@/lib/shopStockSuggestion";
import {
  filterShopStockItemsByVehicleScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";

const MAX_SUGGESTIONS = 10;

async function queryProjectionSuggestions(input: {
  locale: "ua" | "en";
  query: string;
  scope: "auto" | "moto" | null;
}) {
  const read = await observeShopCatalogRead({
    operation: "suggestions",
    locale: input.locale,
    filters: { text: input.query, scope: input.scope },
    databaseQueriesUpperBound: 3,
    rows: (value) => value.length,
    execute: () =>
      queryShopCatalogSuggestions({
        locale: input.locale,
        query: input.query,
        scope: input.scope,
      }),
  });

  // Keep the established stock suggestion response shape. Catalog V2 has no
  // category for some legacy products, while the stock UI renders a string.
  const data = read.value.map((suggestion) =>
    suggestion.type === "product"
      ? { ...suggestion, category: suggestion.category ?? "" }
      : suggestion
  );
  return {
    data,
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      "Server-Timing": shopCatalogServerTiming(read.metric),
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const locale = searchParams.get("locale")?.trim() === "en" ? "en" : "ua";
  const vehicleScope = parseShopStockVehicleScope(searchParams.get("scope"));

  if (query.length > SHOP_SEARCH_QUERY_MAX_LENGTH)
    return NextResponse.json({ error: "Search query is too long", data: [] }, { status: 400 });
  if (query.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
    if (
      isShopCatalogReaderRequestEnabled(
        reader,
        request.headers.get(SHOP_CATALOG_CANARY_REQUEST_HEADER)
      )
    ) {
      const projection = await queryProjectionSuggestions({
        locale,
        query,
        scope: vehicleScope,
      });
      return NextResponse.json(
        { data: projection.data.slice(0, MAX_SUGGESTIONS) },
        { headers: projection.headers }
      );
    }

    let canonicalQuery = canonicalizeShopSearchQuery(query);
    let normalizedQueries = [canonicalQuery];
    let compactQuery = compactShopCode(query);
    let tokens = [...new Set(tokenizeShopSearchQuery(canonicalQuery))];
    const intent = parseVehicleSearchQuery(query);
    const strictSkuQuery = intent === "sku";
    const allowCompactSkuMatch = intent !== "vehicle" && intent !== "mixed";
    const labelMatches = new Map<string, boolean>();
    const matchesLabel = (label: string) => {
      let matches = labelMatches.get(label);
      if (matches === undefined) {
        matches = matchesShopSearchQuery(label, canonicalQuery);
        labelMatches.set(label, matches);
      }
      return matches;
    };
    const allProducts = await getShopProductsWithFitments();
    const products = filterShopStockItemsByVehicleScope(allProducts, vehicleScope);
    const brandMatches = new Map<string, number>();
    const vehicleMatches = new Map<string, { make: string; model?: string; count: number }>();

    const rankProducts = () =>
      products
        .map((item) => {
          const product = item.product;
          const brand = getProductDisplayBrand(product.brand);
          const title =
            locale === "en"
              ? product.title.en || product.title.ua || ""
              : product.title.ua || product.title.en || "";
          const normalizedTitle = normalizeShopSearchText(title);
          const normalizedBrand = normalizeShopSearchText(brand);
          const compactSku = item.compactSkuText;
          if (
            !compactSku.split(" ").includes(compactQuery) &&
            !item.canonicalTitles?.includes(canonicalQuery) &&
            !matchesShopSearchBrandIntent(brand, canonicalQuery)
          )
            return null;
          const tokenMatches = tokens.filter((token) =>
            matchesShopSearchToken(item.searchText, token)
          ).length;

          if (matchesLabel(normalizedBrand)) {
            brandMatches.set(brand, (brandMatches.get(brand) ?? 0) + 1);
          }

          if (item.fitment.make) {
            const normalizedMake = normalizeShopSearchText(item.fitment.make);
            if (matchesLabel(normalizedMake)) {
              const key = item.fitment.make;
              const current = vehicleMatches.get(key);
              vehicleMatches.set(key, {
                make: item.fitment.make,
                count: (current?.count ?? 0) + 1,
              });
            }

            for (const model of item.fitment.models) {
              const label = `${item.fitment.make} ${model}`;
              if (!matchesLabel(label)) continue;
              const current = vehicleMatches.get(label);
              vehicleMatches.set(label, {
                make: item.fitment.make,
                model,
                count: (current?.count ?? 0) + 1,
              });
            }
          }

          if (
            !shouldIncludeStockSuggestionMatch({
              strictSkuQuery,
              tokenCount: tokens.length,
              tokenMatches,
              compactQuery,
              compactSku,
              allowCompactSkuMatch,
            })
          ) {
            return null;
          }

          let score = tokenMatches * 10;
          if (canonicalizeShopSearchQuery(title) === canonicalQuery) score += 10000;
          else if (matchesShopSearchQuery(`${item.titleText} ${item.brandText}`, canonicalQuery))
            score += 2000;
          if (allowCompactSkuMatch && compactQuery && compactSku === compactQuery) score += 120;
          else if (allowCompactSkuMatch && compactQuery && compactSku.includes(compactQuery))
            score += 70;
          if (normalizedQueries.some((variant) => normalizedTitle.startsWith(variant))) score += 50;
          else if (normalizedQueries.some((variant) => normalizedTitle.includes(variant)))
            score += 32;
          if (normalizedQueries.some((variant) => normalizedBrand.startsWith(variant))) score += 28;
          if (normalizedQueries.some((variant) => item.fitmentText.includes(variant))) score += 24;
          if (product.stock === "inStock") score += 8;
          if (product.image || product.gallery?.[0]) score += 5;

          return {
            score,
            suggestion: {
              type: "product" as const,
              id: product.id || product.slug,
              name: title,
              brand,
              partNumber: product.sku || "",
              thumbnail: product.image || product.gallery?.[0] || null,
              slug: product.slug,
              href: buildShopStorefrontProductPathForProduct(locale, product),
              category: getShopStockCategoryLabelForProduct(item, locale),
            },
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => right.score - left.score)
        .slice(0, 6)
        .map((entry) => entry.suggestion);

    let productMatches = rankProducts();
    let correctedQuery: string | null = null;
    if (!productMatches.length && !strictSkuQuery) {
      const recovery = getShopSearchFallbackQuery(query, allProducts);
      if (recovery) {
        canonicalQuery = recovery;
        normalizedQueries = [recovery];
        compactQuery = compactShopCode(recovery);
        tokens = [...new Set(tokenizeShopSearchQuery(recovery))];
        labelMatches.clear();
        brandMatches.clear();
        vehicleMatches.clear();
        productMatches = rankProducts();
        if (productMatches.length) correctedQuery = recovery;
      }
    }
    const brands = Array.from(brandMatches, ([label, count]) => ({
      type: "brand" as const,
      id: `brand:${label}`,
      label,
      count,
    }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 2);

    const vehicles = Array.from(vehicleMatches, ([label, value]) => ({
      type: "vehicle" as const,
      id: `vehicle:${label}`,
      label,
      ...value,
    }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 2);

    return NextResponse.json(
      {
        data: [...productMatches, ...brands, ...vehicles].slice(0, MAX_SUGGESTIONS),
        meta: { correctedQuery },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Stock suggestion search failed:", error);
    return NextResponse.json({ error: "Suggestion search failed", data: [] }, { status: 500 });
  }
}

export const runtime = "nodejs";
