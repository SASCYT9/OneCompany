import { NextRequest, NextResponse } from "next/server";
import { searchTurn14Items, findTurn14BrandIdByName } from "@/lib/turn14";
import { prisma } from "@/lib/prisma";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { calcItemPrice } from "@/lib/shippingCalc";
import { isTurn14Enabled } from "@/lib/shopFeatureFlags";
import {
  loadBrandDiscountMap,
  loadCustomerBrandDiscountMap,
  resolveBrandDiscount,
} from "@/lib/shopBrandB2bDiscounts";

function emptyTurn14Response(meta: { page?: number } = {}) {
  return NextResponse.json({
    data: [],
    meta: { page: meta.page ?? 1, totalPages: 0, totalItems: 0, source: "turn14" },
    filters: { categories: [] },
  });
}

const DEFAULT_MARKUP_PCT = 25;

export type StockSortMode = "newest" | "price-asc" | "price-desc" | "name-asc";

function parseSort(value: string | null | undefined): StockSortMode {
  const v = (value || "").toLowerCase();
  if (v === "price-asc" || v === "price-desc" || v === "name-asc" || v === "newest") {
    return v;
  }
  return "newest";
}

function isTrue(value: string | null | undefined) {
  if (!value) return false;
  return value === "1" || value === "true" || value === "yes";
}

/**
 * GET /api/shop/stock/search
 *
 * Unified stock search across:
 *  - "shop"   — our own ShopProduct catalog (published+active)
 *  - "turn14" — Turn14 distributor catalog (cached in Turn14Item)
 *  - "local"  — other local distributors (StockProduct, e.g. IND)
 *  - "all"    — union of all three (shop first, then turn14, then local)
 *
 * Query params:
 *   source   — "shop" | "turn14" | "local" | "all" (default: "all")
 *   q        — search keyword
 *   brand    — brand filter (matches brand OR vendor for shop items)
 *   category — category filter
 *   page     — pagination
 *   distributor — filter by distributor name for local source
 *   sort     — "newest" | "price-asc" | "price-desc" | "name-asc" (default: "newest")
 *   inStock  — "1" to filter only available items
 *   showAll  — "1" to include turn14 items with price=0 (default: hide them)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = (searchParams.get("source") || "all").toLowerCase();

  const session = await getCurrentShopCustomerSession();
  const b2bDiscountPercent = session ? Number(session.b2bDiscountPercent || 0) : 0;
  const customerId = session?.customerId ?? null;

  if (source === "shop") {
    return handleShopSearch(searchParams, b2bDiscountPercent, customerId);
  }

  if (source === "local") {
    return handleLocalSearch(searchParams, b2bDiscountPercent);
  }

  if (source === "all") {
    return handleCombinedSearch(searchParams, b2bDiscountPercent, customerId);
  }

  // Turn14 live cache — gated behind TURN14_ENABLED feature flag.
  if (!isTurn14Enabled()) {
    return emptyTurn14Response({ page: Number(searchParams.get("page")) || 1 });
  }
  return handleTurn14Search(searchParams, b2bDiscountPercent);
}

// ─── Turn14 live API search ───────────────────────────────────────

async function handleTurn14Search(searchParams: URLSearchParams, b2bDiscountPercent: number) {
  try {
    const keyword = searchParams.get("q") || "";
    const brand = searchParams.get("brand") || "";
    const year = searchParams.get("year") || "";
    const make = searchParams.get("make") || "";
    const model = searchParams.get("model") || "";
    const submodel = searchParams.get("submodel") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const sort = parseSort(searchParams.get("sort"));
    const inStockOnly = isTrue(searchParams.get("inStock"));
    const limit = 24;

    const where: any = {};

    if (brand) where.brand = { contains: brand, mode: "insensitive" };
    if (inStockOnly) where.inStock = true;
    // Note: items with price=0 are kept visible — the UI surfaces them as
    // "Ціна за запитом" with a Quote CTA so dealers can still discover and
    // request brands like REMUS whose Turn14 pricing hasn't been synced yet.

    // Fitment filter across the relation
    if (year || make || model || submodel) {
      where.fitments = {
        some: {
          ...(year && { year }),
          ...(make && { make }),
          ...(model && { model }),
          ...(submodel && { submodel }),
        },
      };
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { partNumber: { contains: keyword, mode: "insensitive" } },
        { brand: { contains: keyword, mode: "insensitive" } },
        { category: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Sort: always float priced items above quote-only items so the in-stock,
    // priced inventory dominates the first pages of a search. Within each
    // tier, respect the requested sort.
    const orderBy: any[] =
      sort === "price-asc"
        ? [{ inStock: "desc" }, { price: "asc" }]
        : sort === "price-desc"
          ? [{ inStock: "desc" }, { price: "desc" }]
          : sort === "name-asc"
            ? [{ inStock: "desc" }, { name: "asc" }]
            : [{ inStock: "desc" }, { price: "desc" }, { name: "asc" }];

    let items: any[] = [];
    let total = 0;

    try {
      [items, total] = await Promise.all([
        prisma.turn14Item.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.turn14Item.count({ where }),
      ]);
    } catch (dbErr) {
      console.warn("[Turn14 Local Search] DB query failed", dbErr);
    }

    // Load available brand markups for the pricing scaler
    let markupMap = new Map<string, number>();
    try {
      const markups = await prisma.turn14BrandMarkup.findMany();
      markupMap = new Map(markups.map((m) => [m.brandName.toLowerCase(), m.markupPct]));
    } catch (dbErr) {
      console.warn("[Turn14 Search] DB unreachable for brand markups");
    }

    const sanitizedItems = items.map((item: any) => {
      const attrs = item.attributes || {};
      const itemBrand = item.brand || attrs.brand || "Unknown";
      const markupPct = markupMap.get(itemBrand.toLowerCase()) ?? DEFAULT_MARKUP_PCT;
      const multiplier = 1 + markupPct / 100;

      const basePrice =
        parseFloat(item.price || attrs.retail_price || attrs.list_price || attrs.price || "0") || 0;

      let finalPrice: number | null = null;
      let originalPrice: number | null = null;

      if (basePrice > 0) {
        const priceRes = calcItemPrice({
          baseCostUsd: basePrice,
          markupPct,
          discountPct: b2bDiscountPercent,
          quantity: 1,
        });
        originalPrice = priceRes.markedUpPrice;
        finalPrice = priceRes.unitPrice;
      }

      return {
        id: item.id,
        name: item.name || attrs.product_name || attrs.item_name || attrs.name || "Auto Part",
        brand: itemBrand,
        partNumber: item.partNumber || attrs.part_number || attrs.mfr_part_number || "",
        category: item.category || attrs.category || null,
        description: attrs.part_description || attrs.description || "",
        thumbnail: item.thumbnail || attrs.thumbnail || attrs.primary_image || null,
        inStock: item.inStock || attrs.regular_stock > 0 || attrs.can_purchase === true,
        basePrice,
        price: finalPrice,
        originalPrice: b2bDiscountPercent > 0 ? originalPrice : null,
        markupPct,
        turn14Id: item.id,
        source: "turn14" as const,
      };
    });

    let distinctCategories: any[] = [];
    try {
      distinctCategories = await prisma.turn14Item.findMany({
        where: brand ? { brand: { contains: brand, mode: "insensitive" } } : {},
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      });
    } catch {}

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages,
        totalItems: total,
        source: "turn14",
      },
      filters: {
        categories: distinctCategories.map((c) => c.category).filter(Boolean),
      },
    });
  } catch (error: any) {
    console.error("[Turn14 Local Search Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Local DB search (IND, future distributors) ───────────────────

async function handleLocalSearch(searchParams: URLSearchParams, b2bDiscountPercent: number) {
  try {
    const q = searchParams.get("q")?.trim() || "";
    const distributor = searchParams.get("distributor")?.trim().toUpperCase() || "";
    const brand = searchParams.get("brand")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const sort = parseSort(searchParams.get("sort"));
    const inStockOnly = isTrue(searchParams.get("inStock"));
    const limit = 24;

    const where: any = {};

    if (distributor) where.distributor = distributor;
    if (brand) where.brand = { contains: brand, mode: "insensitive" };
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (inStockOnly) where.inStock = true;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { partNumber: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderBy: any[] =
      sort === "price-asc"
        ? [{ inStock: "desc" }, { price: "asc" }]
        : sort === "price-desc"
          ? [{ inStock: "desc" }, { price: "desc" }]
          : sort === "name-asc"
            ? [{ inStock: "desc" }, { name: "asc" }]
            : [{ inStock: "desc" }, { name: "asc" }];

    let items: any[] = [];
    let total = 0;
    try {
      [items, total] = await Promise.all([
        prisma.stockProduct.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.stockProduct.count({ where }),
      ]);
    } catch (dbErr) {
      console.warn(
        "[Local Stock] DB unreachable, returning empty results",
        dbErr instanceof Error ? dbErr.message : dbErr
      );
      return NextResponse.json({
        data: [],
        meta: { page, totalPages: 0, totalItems: 0, source: "local" },
        filters: { brands: [], categories: [] },
      });
    }

    const sanitizedItems = items.map((item) => {
      let finalPrice: number | null = null;
      let originalPrice: number | null = null;

      if (item.retailPrice) {
        // If it has a hardcoded retail price, use it as marked up
        originalPrice = item.retailPrice;
        finalPrice = item.retailPrice;
        if (finalPrice !== null && b2bDiscountPercent > 0) {
          finalPrice = Math.round(finalPrice * (1 - b2bDiscountPercent / 100) * 100) / 100;
        }
      } else if (item.price) {
        // Calculate dynamic markup
        const priceRes = calcItemPrice({
          baseCostUsd: item.price,
          markupPct: item.markupPct,
          discountPct: b2bDiscountPercent,
          quantity: 1,
        });
        originalPrice = priceRes.markedUpPrice;
        finalPrice = priceRes.unitPrice;
      }

      return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        partNumber: item.partNumber,
        description: item.description,
        thumbnail: item.thumbnail,
        inStock: item.inStock,
        price: finalPrice,
        originalPrice: b2bDiscountPercent > 0 ? originalPrice : null,
        basePrice: item.price || 0,
        markupPct: item.markupPct,
        turn14Id: "", // no turn14 id for local products
        source: "local" as const,
        distributor: item.distributor,
        category: item.category,
      };
    });

    // Get available filter values
    const [brands, categories] = await Promise.all([
      prisma.stockProduct.findMany({
        where: distributor ? { distributor } : {},
        select: { brand: true },
        distinct: ["brand"],
        orderBy: { brand: "asc" },
      }),
      prisma.stockProduct.findMany({
        where: distributor ? { distributor } : {},
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        source: "local",
      },
      filters: {
        brands: brands.map((b) => b.brand).filter(Boolean),
        categories: categories.map((c) => c.category).filter(Boolean),
      },
    });
  } catch (error: any) {
    console.error("[Local Stock Search Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Own catalog search (ShopProduct) ─────────────────────────────

async function handleShopSearch(
  searchParams: URLSearchParams,
  b2bDiscountPercent: number,
  customerId: string | null = null
) {
  try {
    const q = searchParams.get("q")?.trim() || "";
    const brand = searchParams.get("brand")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const sort = parseSort(searchParams.get("sort"));
    const inStockOnly = isTrue(searchParams.get("inStock"));
    // Vehicle fitment cascade — slugs (lowercased) from structured fitment
    // tags emitted by the REMUS importer (`fits-make:vw`, etc.).
    const vMake = (searchParams.get("make") || "").trim().toLowerCase();
    const vModel = (searchParams.get("model") || "").trim().toLowerCase();
    const vTrim = (searchParams.get("trim") || "").trim().toLowerCase();
    const limit = 24;

    const where: any = { isPublished: true, status: "ACTIVE" };
    if (inStockOnly) {
      where.NOT = [{ stock: "outOfStock" }];
    }

    // Vehicle fitment via tag containment. Most specific wins: trim ⊃
    // model ⊃ make. We apply only the most specific one because a trim
    // tag implies its model and make are already covered.
    const fitTagsRequired: string[] = [];
    if (vMake && vModel && vTrim) {
      fitTagsRequired.push(`fits-trim:${vMake}:${vModel}:${vTrim}`);
    } else if (vMake && vModel) {
      fitTagsRequired.push(`fits-model:${vMake}:${vModel}`);
    } else if (vMake) {
      fitTagsRequired.push(`fits-make:${vMake}`);
    }
    if (fitTagsRequired.length > 0) {
      where.tags = { hasEvery: fitTagsRequired };
    }

    if (brand) {
      where.OR = [
        { brand: { contains: brand, mode: "insensitive" } },
        { vendor: { contains: brand, mode: "insensitive" } },
      ];
    }
    if (category) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { categoryEn: { contains: category, mode: "insensitive" } },
            { categoryUa: { contains: category, mode: "insensitive" } },
            { productCategory: { contains: category, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (q) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { titleEn: { contains: q, mode: "insensitive" } },
            { titleUa: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { vendor: { contains: q, mode: "insensitive" } },
            { shortDescEn: { contains: q, mode: "insensitive" } },
            { shortDescUa: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    // Prisma can't sort by the COALESCE of priceUsdB2b/priceUsd/priceEur.
    // Use priceUsd as the primary sort key — it's set for the vast majority
    // of products. Items with null priceUsd land at the end naturally.
    const orderBy: any[] =
      sort === "price-asc"
        ? [{ priceUsd: "asc" }, { updatedAt: "desc" }]
        : sort === "price-desc"
          ? [{ priceUsd: "desc" }, { updatedAt: "desc" }]
          : sort === "name-asc"
            ? [{ titleEn: "asc" }]
            : [{ updatedAt: "desc" }];

    let items: any[] = [];
    let total = 0;
    try {
      [items, total] = await Promise.all([
        prisma.shopProduct.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            slug: true,
            sku: true,
            brand: true,
            vendor: true,
            tags: true,
            titleEn: true,
            titleUa: true,
            shortDescEn: true,
            shortDescUa: true,
            image: true,
            stock: true,
            priceEur: true,
            priceUsd: true,
            priceUsdB2b: true,
            priceEurB2b: true,
            compareAtUsd: true,
            compareAtEur: true,
          },
        }),
        prisma.shopProduct.count({ where }),
      ]);
    } catch (dbErr) {
      console.warn("[Shop Catalog Search] DB query failed", dbErr);
    }

    // 3-tier discount resolution: pre-load BOTH maps once per request so
    // per-item resolveBrandDiscount() is in-memory only. ~250 system rows +
    // <50 per-customer overrides — negligible payload.
    const [systemBrandMap, customerBrandMap] = await Promise.all([
      loadBrandDiscountMap(prisma).catch(() => new Map<string, number>()),
      loadCustomerBrandDiscountMap(prisma, customerId).catch(() => new Map<string, number>()),
    ]);

    const sanitizedItems = items.map((p) => {
      const name = p.titleEn || p.titleUa || "Product";
      const description = p.shortDescEn || p.shortDescUa || "";
      // Prefer USD; fall back to EUR. B2B-specific price wins if present.
      const b2bPrice = p.priceUsdB2b ?? p.priceEurB2b;
      const retail = p.priceUsd ?? p.priceEur;
      const compareAt = p.compareAtUsd ?? p.compareAtEur;
      const basePrice = Number(retail ?? 0);

      // Effective discount % for this brand: customer-brand > system-brand
      // > customer-global. See src/lib/shopBrandB2bDiscounts.ts.
      const effDiscount = resolveBrandDiscount(
        p.brand ?? p.vendor ?? null,
        customerBrandMap,
        systemBrandMap,
        b2bDiscountPercent
      );
      const effectivePct = effDiscount.pct;

      let finalPrice: number | null = null;
      let originalPrice: number | null = null;
      if (b2bPrice != null) {
        finalPrice = Number(b2bPrice);
        originalPrice = Number(retail ?? compareAt ?? b2bPrice);
      } else if (retail != null) {
        const retailNum = Number(retail);
        originalPrice = Number(compareAt ?? retailNum);
        finalPrice =
          effectivePct > 0
            ? Math.round(retailNum * (1 - effectivePct / 100) * 100) / 100
            : retailNum;
      }

      return {
        id: p.id,
        name,
        brand: p.brand || p.vendor || "Unknown",
        partNumber: p.sku || "",
        category: null as string | null,
        description,
        thumbnail: p.image || null,
        inStock: (p.stock || "inStock") !== "outOfStock",
        basePrice,
        price: finalPrice,
        originalPrice: effectivePct > 0 || b2bPrice != null ? originalPrice : null,
        markupPct: 0,
        // Expose the resolved discount % + its source so the UI can show
        // "B2B -10% (per brand)" tooltips on cards if useful later.
        discountPct: effectivePct,
        discountSource: effDiscount.source,
        turn14Id: "",
        slug: p.slug,
        // Forward vendor + tags so the storefront URL builder can pick the
        // right brand-shop segment via buildShopStorefrontProductPath().
        vendor: p.vendor ?? null,
        tags: p.tags ?? [],
        source: "shop" as const,
      };
    });

    return NextResponse.json({
      data: sanitizedItems,
      meta: {
        page,
        totalPages: Math.ceil(total / limit) || 1,
        totalItems: total,
        source: "shop",
      },
      filters: { categories: [], brands: [] },
    });
  } catch (error: any) {
    console.error("[Shop Catalog Search Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Combined search (Shop + Turn14 + local) ──────────────────────

async function handleCombinedSearch(
  searchParams: URLSearchParams,
  b2bDiscountPercent: number,
  customerId: string | null = null
) {
  try {
    // NOTE: parallel reads against the same pgbouncer pool — fine here because
    // each handler runs at most ~2-3 sequential queries, well under the pool.
    // Turn14 is gated by feature flag; when disabled we synthesize an empty
    // settled result so the rest of the merge stays simple.
    const turn14Task = isTurn14Enabled()
      ? handleTurn14Search(searchParams, b2bDiscountPercent).then((r) => r.json())
      : Promise.resolve({ data: [] });
    const [shopRes, turn14Res, localRes] = await Promise.allSettled([
      handleShopSearch(searchParams, b2bDiscountPercent, customerId).then((r) => r.json()),
      turn14Task,
      handleLocalSearch(searchParams, b2bDiscountPercent).then((r) => r.json()),
    ]);

    const shopData = shopRes.status === "fulfilled" ? shopRes.value.data || [] : [];
    const turn14Data = turn14Res.status === "fulfilled" ? turn14Res.value.data || [] : [];
    const localData = localRes.status === "fulfilled" ? localRes.value.data || [] : [];

    // Our own catalog first (best margins, in-house inventory), then Turn14,
    // then other local distributors.
    const combined = [...shopData, ...turn14Data, ...localData];

    return NextResponse.json({
      data: combined,
      meta: {
        page: 1,
        totalPages: 1,
        totalItems: combined.length,
        source: "all",
        shopCount: shopData.length,
        turn14Count: turn14Data.length,
        localCount: localData.length,
      },
    });
  } catch (error: any) {
    console.error("[Combined Search Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
