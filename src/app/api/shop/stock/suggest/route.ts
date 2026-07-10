import { NextRequest, NextResponse } from "next/server";

import {
  getProductDisplayBrand,
  getShopProductsWithFitments,
} from "@/app/api/shop/stock/search/route";
import { compactShopCode, parseVehicleSearchQuery } from "@/lib/shopVehicleSearch";
import { normalizeShopSearchText, tokenizeShopSearchQuery } from "@/lib/shopSearch";
import { getShopStockCategoryLabelForProduct } from "@/lib/shopStockTaxonomy";
import { shouldIncludeStockSuggestionMatch } from "@/lib/shopStockSuggestion";

const MAX_SUGGESTIONS = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const locale = searchParams.get("locale")?.trim() || "ua";

  if (query.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const normalizedQuery = normalizeShopSearchText(query);
    const compactQuery = compactShopCode(query);
    const tokens = tokenizeShopSearchQuery(query);
    const strictSkuQuery = parseVehicleSearchQuery(query) === "sku";
    const products = await getShopProductsWithFitments();
    const brandMatches = new Map<string, number>();
    const vehicleMatches = new Map<string, { make: string; model?: string; count: number }>();

    const productMatches = products
      .map((item) => {
        const product = item.product;
        const brand = getProductDisplayBrand(product.brand);
        const title =
          locale === "en"
            ? product.title.en || product.title.ua || ""
            : product.title.ua || product.title.en || "";
        const normalizedTitle = normalizeShopSearchText(title);
        const normalizedBrand = normalizeShopSearchText(brand);
        const compactSku = compactShopCode(product.sku || "");
        const tokenMatches = tokens.filter((token) => item.searchText.includes(token)).length;

        if (normalizedBrand.includes(normalizedQuery)) {
          brandMatches.set(brand, (brandMatches.get(brand) ?? 0) + 1);
        }

        if (item.fitment.make) {
          const normalizedMake = normalizeShopSearchText(item.fitment.make);
          if (normalizedMake.includes(normalizedQuery)) {
            const key = item.fitment.make;
            const current = vehicleMatches.get(key);
            vehicleMatches.set(key, {
              make: item.fitment.make,
              count: (current?.count ?? 0) + 1,
            });
          }

          for (const model of item.fitment.models) {
            const label = `${item.fitment.make} ${model}`;
            if (!normalizeShopSearchText(label).includes(normalizedQuery)) continue;
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
          })
        ) {
          return null;
        }

        let score = tokenMatches * 10;
        if (compactQuery && compactSku === compactQuery) score += 120;
        else if (compactQuery && compactSku.includes(compactQuery)) score += 70;
        if (normalizedTitle.startsWith(normalizedQuery)) score += 50;
        else if (normalizedTitle.includes(normalizedQuery)) score += 32;
        if (normalizedBrand.startsWith(normalizedQuery)) score += 28;
        if (item.fitmentText.includes(normalizedQuery)) score += 24;
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
            category: getShopStockCategoryLabelForProduct(item, locale),
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)
      .map((entry) => entry.suggestion);

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
      { data: [...brands, ...vehicles, ...productMatches].slice(0, MAX_SUGGESTIONS) },
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
