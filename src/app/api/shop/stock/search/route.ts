import { NextRequest, NextResponse } from "next/server";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import { extractProductFitment, areChassisCompatible, type Fitment } from "@/lib/crossShopFitment";
import { prisma } from "@/lib/prisma";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
} from "@/lib/shopPricingAudience";
import { tokenizeShopSearchQuery, normalizeShopSearchText } from "@/lib/shopSearch";

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

      // Build text for matches search
      const searchText = [
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
        ...(product.tags ?? []),
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" ");

      return {
        product,
        fitment,
        searchText: normalizeShopSearchText(searchText),
      };
    });
    cachedTimestamp = now;
  }

  return cachedProductsWithFitment;
}

function computeRelevanceScore(
  searchText: string,
  queryTokens: string[],
  brand?: string,
  titleEn?: string,
  titleUa?: string
) {
  let score = 0;

  for (const token of queryTokens) {
    if (searchText.includes(token)) {
      score += 1.0;

      // Boost if token matches brand or title directly
      if (brand && brand.toLowerCase().includes(token)) {
        score += 0.5;
      }
      if (titleEn && titleEn.toLowerCase().includes(token)) {
        score += 0.5;
      }
      if (titleUa && titleUa.toLowerCase().includes(token)) {
        score += 0.5;
      }
    }
  }

  return score / queryTokens.length;
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
    const locale = searchParams.get("locale")?.trim() || "ua";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const all = searchParams.get("all") === "true";
    const limit = 24;

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
      session?.b2bDiscountPercent ?? null
    );

    const getProductPriceForSort = (product: any) => {
      const pricing = resolveShopProductPricing(product, pricingContext);
      if (pricing.effectivePrice.usd > 0) return pricing.effectivePrice.usd;
      if (pricing.effectivePrice.eur > 0) return pricing.effectivePrice.eur * 1.08;
      if (pricing.effectivePrice.uah > 0) return pricing.effectivePrice.uah / 40.0;
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
      const categoryLower = category.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.product.category?.ua && item.product.category.ua.toLowerCase() === categoryLower) ||
          (item.product.category?.en && item.product.category.en.toLowerCase() === categoryLower)
      );
    }

    if (make) {
      const makeLower = make.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.fitment.make && item.fitment.make.toLowerCase() === makeLower) ||
          item.searchText.includes(makeLower)
      );
    }

    if (model) {
      const modelLower = model.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.fitment.models.some((m) => m.toLowerCase() === modelLower) ||
          item.searchText.includes(modelLower)
      );
    }

    if (chassis) {
      const chassisLower = chassis.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.fitment.chassisCodes.some((c) => areChassisCompatible(c, chassis.toUpperCase())) ||
          item.searchText.includes(chassisLower)
      );
    }

    // 2. Search query with relevance scoring
    const queryTokens = tokenizeShopSearchQuery(q);
    let scoredItems = filtered.map((item) => {
      let score = 1;
      const displayBrand = getProductDisplayBrand(item.product.brand);
      if (q && queryTokens.length > 0) {
        score = computeRelevanceScore(
          item.searchText,
          queryTokens,
          displayBrand,
          item.product.title?.en,
          item.product.title?.ua
        );
      }
      return { ...item, score };
    });

    if (q && queryTokens.length > 0) {
      // Keep only matches
      scoredItems = scoredItems.filter((item) => item.score > 0);
      // Sort by relevance score descending
      scoredItems.sort((a, b) => b.score - a.score);
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

    if (totalItems === 0 && q && (make || model || chassis || brand || category)) {
      // Fallback 1: Ignore vehicle fitment filters
      let fallbackFiltered = productsWithFitments;
      if (brand) {
        const brandLower = brand.toLowerCase();
        fallbackFiltered = fallbackFiltered.filter(
          (item) => getProductDisplayBrand(item.product.brand).toLowerCase() === brandLower
        );
      }
      if (category) {
        const categoryLower = category.toLowerCase();
        fallbackFiltered = fallbackFiltered.filter(
          (item) =>
            (item.product.category?.ua &&
              item.product.category.ua.toLowerCase() === categoryLower) ||
            (item.product.category?.en && item.product.category.en.toLowerCase() === categoryLower)
        );
      }

      const fallbackScored = fallbackFiltered
        .map((item) => {
          const displayBrand = getProductDisplayBrand(item.product.brand);
          const score = computeRelevanceScore(
            item.searchText,
            queryTokens,
            displayBrand,
            item.product.title?.en,
            item.product.title?.ua
          );
          return { ...item, score };
        })
        .filter((item) => item.score > 0);

      fallbackScored.sort((a, b) => b.score - a.score);

      if (fallbackScored.length > 0) {
        fallbackApplied = "fitment";
        totalItems = fallbackScored.length;
        totalPages = Math.ceil(totalItems / limit);
        paginatedItems = fallbackScored.slice((page - 1) * limit, page * limit);
      } else if (brand || category) {
        // Fallback 2: Ignore brand/category as well (global query match)
        const globalScored = productsWithFitments
          .map((item) => {
            const displayBrand = getProductDisplayBrand(item.product.brand);
            const score = computeRelevanceScore(
              item.searchText,
              queryTokens,
              displayBrand,
              item.product.title?.en,
              item.product.title?.ua
            );
            return { ...item, score };
          })
          .filter((item) => item.score > 0);

        globalScored.sort((a, b) => b.score - a.score);

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

      const dealerPrice =
        pricing.effectivePrice.usd > 0
          ? pricing.effectivePrice.usd
          : pricing.effectivePrice.eur > 0
            ? pricing.effectivePrice.eur * 1.08
            : 0;

      const msrp =
        pricing.effectiveCompareAt && pricing.effectiveCompareAt.usd > 0
          ? pricing.effectiveCompareAt.usd
          : pricing.bands?.b2c?.price?.usd > 0
            ? pricing.bands.b2c.price.usd
            : pricing.bands?.b2c?.price?.eur > 0
              ? pricing.bands.b2c.price.eur * 1.08
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
        priceUsd: pricing.effectivePrice.usd || 0,
        priceEur: pricing.effectivePrice.eur || 0,
        originalPrice: msrp,
        markupPct: pricing.discountPercent || 0,
        slug: product.slug,
        variantId: defaultVariant?.id || null,
        turn14Id: "", // empty so frontend knows it's a shop product
        source: "local" as const,
      };
    });

    // Extract all unique brands and categories for filter menus
    const brands = Array.from(
      new Set(
        productsWithFitments.map((p) => getProductDisplayBrand(p.product.brand)).filter(Boolean)
      )
    ).sort();
    const categories = Array.from(
      new Set(
        productsWithFitments
          .map((p) =>
            locale === "en"
              ? p.product.category?.en || p.product.category?.ua
              : p.product.category?.ua || p.product.category?.en
          )
          .filter(Boolean)
      )
    ).sort();

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages,
        totalItems,
        source: "local",
        fallbackApplied,
      },
      filters: {
        brands,
        categories,
      },
    });
  } catch (error: any) {
    console.error("[Stock Search API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
