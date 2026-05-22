import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/shop/stock/fitments?make=&model=
 *
 * Cascading vehicle-fitment options for the B2B portal's Make→Model→Trim
 * filter. Reads structured fitment tags from `ShopProduct.tags`:
 *
 *   fits-make:<makeSlug>            e.g. fits-make:vw
 *   fits-model:<make>:<model>       e.g. fits-model:vw:golf-8
 *   fits-trim:<make>:<model>:<trim> e.g. fits-trim:vw:golf-8:r
 *
 * Without params → returns the list of makes (slug + display label +
 * product count).
 * With ?make=vw → returns models within that make.
 * With ?make=vw&model=golf-8 → returns trims within that model.
 *
 * Results are derived via `unnest(tags)` aggregation in Postgres so we
 * don't have to stream the full catalog to the app. Cached in-memory for
 * 10 minutes (same TTL as /api/shop/stock/brands).
 */

// v2 — restructured GROUP BY via subquery (2026-05-20)
type FitmentOption = { slug: string; label: string; count: number };

const CACHE_TTL_MS = 10 * 60 * 1000;
type CacheEntry = { expires: number; data: FitmentOption[] };
const cache = new Map<string, CacheEntry>();

function getCached(key: string): FitmentOption[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
function setCached(key: string, data: FitmentOption[]) {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
}

// Pretty-format a slug back into a display label. "vw" → "VW", "golf-8" →
// "Golf 8", "audi-rs3-sportback" → "Audi RS3 Sportback". Special-case the
// known short acronym makes that should stay all-caps.
const ALL_CAPS_TOKENS = new Set([
  "vw",
  "bmw",
  "gmc",
  "kia",
  "mg",
  "jcw",
  "amg",
  "rs",
  "rs3",
  "rs4",
  "rs5",
  "rs6",
  "rs7",
  "rsq3",
  "rsq8",
  "gt",
  "gti",
  "gts",
  "st",
  "sr",
  "gp",
]);
function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .map((token) => {
      if (!token) return token;
      if (ALL_CAPS_TOKENS.has(token.toLowerCase())) return token.toUpperCase();
      if (/^\d+$/.test(token)) return token; // pure numeric year/version
      // Mixed alphanumeric like "g87" → keep as-is uppercased.
      if (/^[a-z]\d+$/i.test(token)) return token.toUpperCase();
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ");
}

async function aggregateTagsByPrefix(prefix: string): Promise<FitmentOption[]> {
  // Postgres GIN on text[] supports `@>` containment but extracting the
  // distinct *values* still needs `unnest`. For ~10k Remus products this
  // is ~50ms — cheap and covered by 10-min in-memory cache.
  //
  // Wrap in a subquery so we can GROUP BY the derived slug column —
  // Postgres won't accept aliases of unnest() output in an outer
  // GROUP BY clause directly.
  const offset = prefix.length;
  const likePattern = prefix + "%";
  // Prisma binds JS numbers as bigint, but `substring(text FROM N)` in
  // Postgres only accepts integer. Cast the bound parameter via ::int.
  const rows = await prisma.$queryRaw<Array<{ slug: string; count: bigint }>>`
    SELECT slug, COUNT(*)::bigint AS count FROM (
      SELECT substring(tag from ${offset + 1}::int) AS slug
      FROM "ShopProduct", unnest(tags) AS tag
      WHERE "isPublished" = true
        AND status = 'ACTIVE'
        AND tag LIKE ${likePattern}
    ) t
    WHERE slug <> '' AND slug NOT LIKE '%:%'
    GROUP BY slug
    ORDER BY count DESC, slug ASC
  `;
  return rows.map((r) => ({
    slug: r.slug,
    label: prettifySlug(r.slug),
    count: Number(r.count),
  }));
}

export async function GET(request: NextRequest) {
  const make = (request.nextUrl.searchParams.get("make") || "").trim().toLowerCase();
  const model = (request.nextUrl.searchParams.get("model") || "").trim().toLowerCase();
  const bust = request.nextUrl.searchParams.get("bust") === "1";

  const cacheKey = `fitments:v2:${make}|${model}`;
  if (!bust) {
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json({ data: cached, cached: true });
    }
  }

  try {
    let data: FitmentOption[] = [];
    if (!make) {
      data = await aggregateTagsByPrefix("fits-make:");
    } else if (!model) {
      data = await aggregateTagsByPrefix(`fits-model:${make}:`);
    } else {
      data = await aggregateTagsByPrefix(`fits-trim:${make}:${model}:`);
    }
    console.log(`[stock/fitments] key=${cacheKey} rows=${data.length}`);
    setCached(cacheKey, data);
    return NextResponse.json({ data, cached: false });
  } catch (error: any) {
    console.error("[stock/fitments] failed", error);
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
}
