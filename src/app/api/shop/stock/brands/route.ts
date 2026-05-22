import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  brandAliasesLower,
  canonicalBrandLabel,
  normalizeBrandKey,
} from "@/lib/stockBrandWhitelist";
import { isTurn14Enabled } from "@/lib/shopFeatureFlags";

/**
 * GET /api/shop/stock/brands?source=shop|turn14|local|all
 *
 * Brand-filter dropdown for the B2B Склад page. Returns whitelisted tuning
 * brands with item counts (`{ name, count }[]`).
 *
 * Performance notes (2026-05-20 — "це зжирає базу"):
 *   - Whitelist filter is pushed into SQL (`LOWER(brand) = ANY($1)`) so we
 *     never stream the full ShopProduct / Turn14Item tables to the app.
 *     Even when source="all", only the ~20 grouped rows per source come
 *     back over the wire.
 *   - Results are memoized in a module-level Map for 10 minutes. Brand
 *     inventories change at most a few times per day (import jobs), so a
 *     stale read up to 10 min is acceptable. Cache key = `source`.
 *   - For ShopProduct rows the "effective brand" is picked at the SQL
 *     level via CASE: brand wins if whitelisted, else vendor (handles Urban
 *     Automotive items where `brand="Range Rover"` is a fitment).
 */

type BrandRow = { name: string; count: number };

const CACHE_TTL_MS = 10 * 60 * 1000;
type CacheEntry = { expires: number; data: BrandRow[] };
const cache = new Map<string, CacheEntry>();

function getCached(key: string): BrandRow[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: BrandRow[]) {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
}

async function aggregateShopBrands(aliases: readonly string[]): Promise<Map<string, number>> {
  // One round-trip. CASE picks "effective brand" per row (brand wins if
  // whitelisted else vendor), WHERE prunes to whitelisted rows only,
  // GROUP BY in SQL produces the final ~25-row result set.
  const rows = await prisma.$queryRaw<Array<{ brand: string | null; count: bigint }>>`
    SELECT
      CASE
        WHEN LOWER(brand) = ANY(${aliases}::text[]) THEN brand
        WHEN LOWER(vendor) = ANY(${aliases}::text[]) THEN vendor
        ELSE NULL
      END AS brand,
      COUNT(*)::bigint AS count
    FROM "ShopProduct"
    WHERE "isPublished" = true
      AND status = 'ACTIVE'
      AND (
        LOWER(brand) = ANY(${aliases}::text[])
        OR LOWER(vendor) = ANY(${aliases}::text[])
      )
    GROUP BY 1
  `;
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!r.brand) continue;
    out.set(r.brand, (out.get(r.brand) ?? 0) + Number(r.count));
  }
  return out;
}

async function aggregateTurn14Brands(aliases: readonly string[]): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ brand: string; count: bigint }>>`
    SELECT brand, COUNT(*)::bigint AS count
    FROM "Turn14Item"
    WHERE brand IS NOT NULL
      AND brand <> ''
      AND LOWER(brand) = ANY(${aliases}::text[])
    GROUP BY brand
  `;
  return new Map(rows.map((r) => [r.brand, Number(r.count)]));
}

async function aggregateLocalBrands(aliases: readonly string[]): Promise<Map<string, number>> {
  try {
    const rows = await prisma.$queryRaw<Array<{ brand: string; count: bigint }>>`
      SELECT brand, COUNT(*)::bigint AS count
      FROM "StockProduct"
      WHERE brand IS NOT NULL
        AND brand <> ''
        AND LOWER(brand) = ANY(${aliases}::text[])
      GROUP BY brand
    `;
    return new Map(rows.map((r) => [r.brand, Number(r.count)]));
  } catch {
    // StockProduct table optional — table absence is fine.
    return new Map();
  }
}

export async function GET(request: NextRequest) {
  const source = (request.nextUrl.searchParams.get("source") || "all").toLowerCase();
  const cacheKey = `brands:v2:${source}`;

  const fromCache = getCached(cacheKey);
  if (fromCache) {
    return NextResponse.json({ data: fromCache, cached: true });
  }

  try {
    const aliases = brandAliasesLower as string[];
    const buckets: Array<Map<string, number>> = [];

    // Run independent source queries in parallel — each is a single
    // grouped query, so the pool sees at most 3 cheap reads. Turn14 is
    // gated by the TURN14_ENABLED feature flag.
    const turn14On = isTurn14Enabled();
    const tasks: Array<Promise<Map<string, number>>> = [];
    if (source === "shop" || source === "all") tasks.push(aggregateShopBrands(aliases));
    if ((source === "turn14" || source === "all") && turn14On)
      tasks.push(aggregateTurn14Brands(aliases));
    if (source === "local" || source === "all") tasks.push(aggregateLocalBrands(aliases));
    const results = await Promise.all(tasks);
    buckets.push(...results);

    // Merge with normalized-key dedupe (Öhlins + OHLINS + Ohlins → one row).
    const merged = new Map<string, BrandRow>();
    for (const bucket of buckets) {
      for (const [name, count] of bucket) {
        const key = normalizeBrandKey(name);
        if (!key) continue;
        const existing = merged.get(key);
        if (existing) {
          existing.count += count;
        } else {
          merged.set(key, { name: canonicalBrandLabel(name), count });
        }
      }
    }

    const data = [...merged.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    );

    setCached(cacheKey, data);
    return NextResponse.json({ data, cached: false });
  } catch (error: any) {
    console.error("[stock/brands] failed", error);
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
}
