/**
 * GLOBAL Turn14 catalog sync — single walk, multi-brand, resumable.
 *
 * Why this exists:
 *   - Turn14's /v1/items endpoint silently ignores ALL filter params on our
 *     access tier (we proved this via the probe endpoint). Every request
 *     returns the global catalog (~747 pages × 1000 items).
 *   - The existing /api/admin/turn14-sync route walks the catalog ONCE
 *     PER BRAND (post-filtering each time), which is wasteful — 30 brands
 *     × 747 pages = 22k API calls.
 *   - This route walks the catalog ONCE, partitions items by brand_id, and
 *     upserts only items belonging to brands listed in BRANDS_LIST.txt
 *     (intersected with what Turn14 actually carries). Same result, ~30×
 *     fewer API calls and fits comfortably under the Prisma Postgres Pro
 *     daily ops budget.
 *
 * Behavior:
 *   - Reads BRANDS_LIST.txt at runtime, skips section headers ([...] / ===).
 *   - Fetches /v1/brands and intersects (case-insensitive, with substring
 *     match for "Burger Motorsport(s)" → "Burger Tuning" naming drift).
 *   - Auto-seeds Turn14BrandMarkup so the existing per-brand cron and
 *     pricing flows light up too.
 *   - Walks catalog; skips items whose attributes.brand_id isn't in our
 *     target set. Upserts kept items into Turn14Item with their brandId.
 *   - Throttled to ~4 req/s (Turn14 caps at 5).
 *   - Resumable via `?startPage=N` query param. Honors a soft wall-clock
 *     budget (`?maxSeconds=240`, default) and returns `nextPage` when it
 *     stops early so the caller can resume in a follow-up POST.
 *
 * Read-only inputs: BRANDS_LIST.txt, Turn14 API.
 * Writes: Turn14BrandMarkup (upsert), Turn14Item (upsert). Never touches
 *   ShopProduct, titles, descriptions, or images.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { fetchTurn14Brands, getTurn14AccessToken } from '@/lib/turn14';

const TURN14_API_BASE = 'https://api.turn14.com/v1';
const REQ_INTERVAL_MS = 260; // ~4 req/s, under Turn14's 5 req/s cap

let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + REQ_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

function parseBrandsList(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('===')) continue; // section header
    if (line.startsWith('[') && line.endsWith(']')) continue; // sub-section header
    out.push(line);
  }
  return Array.from(new Set(out));
}

function buildTargetMap(
  brandsListNames: string[],
  turn14Brands: Array<{ id: string; name: string }>,
): Map<string, string> {
  // Returns Map<turn14BrandId, displayName>.
  const m = new Map<string, string>();
  const lowerNames = brandsListNames.map((n) => n.trim().toLowerCase());
  for (const tb of turn14Brands) {
    const lc = tb.name.toLowerCase();
    const exact = lowerNames.includes(lc);
    const substring = lowerNames.some(
      (n) => (n.length >= 4 && lc.includes(n)) || (lc.length >= 4 && n.includes(lc)),
    );
    if (exact || substring) {
      // Prefer Turn14's canonical name as displayName (matches /v1/brands).
      m.set(tb.id, tb.name);
    }
  }
  return m;
}

async function fetchPage(page: number): Promise<{ data: any[]; meta: any }> {
  const token = await getTurn14AccessToken();
  const res = await fetch(`${TURN14_API_BASE}/items?page=${page}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turn14 /v1/items page=${page} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);

  const url = new URL(req.url);
  const startPage = Math.max(1, parseInt(url.searchParams.get('startPage') || '1', 10));
  const maxPages = Math.max(1, parseInt(url.searchParams.get('maxPages') || '760', 10));
  // Vercel function timeout is 300s on Pro. Default budget 240s leaves room
  // for response serialization and a graceful exit.
  const maxSeconds = Math.max(30, parseInt(url.searchParams.get('maxSeconds') || '240', 10));

  const startedAt = Date.now();

  // 1. Read BRANDS_LIST.txt (works in Vercel because it's part of the repo
  //    and not gitignored). process.cwd() in Next.js routes is the project
  //    root.
  let brandsListNames: string[] = [];
  try {
    const txt = await fs.readFile(path.join(process.cwd(), 'BRANDS_LIST.txt'), 'utf8');
    brandsListNames = parseBrandsList(txt);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not read BRANDS_LIST.txt',
        detail: (err as Error).message,
      },
      { status: 500 },
    );
  }

  // 2. Fetch Turn14 /v1/brands and intersect.
  await throttle();
  const brandsRes = await fetchTurn14Brands();
  const allTurn14Brands: Array<{ id: string; name: string }> = ((brandsRes?.data || []) as any[])
    .map((b): { id: string; name: string } => ({
      id: String(b?.id ?? ''),
      name: ((b?.attributes?.name || b?.name || '') as string).trim(),
    }))
    .filter((b) => b.id && b.name);
  const targetMap = buildTargetMap(brandsListNames, allTurn14Brands);

  if (targetMap.size === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'No overlap between BRANDS_LIST.txt and Turn14 brands list.',
        brandsListCount: brandsListNames.length,
        turn14BrandsCount: allTurn14Brands.length,
      },
      { status: 500 },
    );
  }

  // 3. Auto-seed Turn14BrandMarkup so existing pricing/sync flows wake up.
  let markupsUpserted = 0;
  for (const [brandId, brandName] of targetMap) {
    await prisma.turn14BrandMarkup.upsert({
      where: { brandId },
      create: { id: brandId, brandId, brandName },
      update: { brandName },
    });
    markupsUpserted++;
  }

  // 4. Walk catalog, save matching items.
  let page = startPage;
  let totalItemsSeen = 0;
  let totalItemsKept = 0;
  let totalItemsUpserted = 0;
  const perBrandUpserted: Record<string, number> = {};
  let totalPagesFromMeta: number | undefined;
  let nextPage: number | null = null;

  while (page <= maxPages) {
    const elapsedSec = (Date.now() - startedAt) / 1000;
    if (elapsedSec > maxSeconds) {
      nextPage = page;
      break;
    }

    let body: { data: any[]; meta: any };
    try {
      await throttle();
      body = await fetchPage(page);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: `fetch failed at page ${page}: ${(err as Error).message}`,
          progress: {
            startPage,
            stoppedAtPage: page,
            totalItemsSeen,
            totalItemsKept,
            totalItemsUpserted,
            perBrandUpserted,
            elapsedSec,
            markupsUpserted,
          },
        },
        { status: 502 },
      );
    }

    const items = body?.data || [];
    if (items.length === 0) break;
    totalItemsSeen += items.length;
    if (totalPagesFromMeta === undefined && body?.meta?.total_pages) {
      totalPagesFromMeta = Number(body.meta.total_pages);
    }

    // Filter and prep upserts.
    const ops: Array<Promise<unknown>> = [];
    for (const it of items) {
      const attrs = it?.attributes || {};
      const itemBrandId = attrs.brand_id !== undefined ? String(attrs.brand_id) : null;
      if (!itemBrandId || !targetMap.has(itemBrandId)) continue;

      totalItemsKept++;
      const partNumber: string =
        (attrs.part_number || attrs.mfr_part_number || '').toString();
      const name: string = (attrs.product_name || attrs.item_name || attrs.name || 'Auto Part').toString();
      const brandName = targetMap.get(itemBrandId) as string;
      const category = attrs.category ?? null;
      const subcategory = attrs.subcategory ?? null;
      const price =
        parseFloat(
          attrs.retail_price || attrs.list_price || attrs.price || '0',
        ) || 0;
      const inStock =
        attrs.regular_stock > 0 ||
        attrs.can_purchase === true ||
        attrs.in_stock === true;
      const thumbnail =
        attrs.thumbnail || attrs.primary_image || attrs.image_url || null;

      ops.push(
        prisma.turn14Item.upsert({
          where: { id: String(it.id) },
          create: {
            id: String(it.id),
            partNumber,
            brand: brandName,
            brandId: itemBrandId,
            name,
            category,
            subcategory,
            price,
            inStock,
            thumbnail,
            attributes: attrs,
          },
          update: {
            partNumber,
            brand: brandName,
            brandId: itemBrandId,
            name,
            category,
            subcategory,
            price,
            inStock,
            thumbnail,
            attributes: attrs,
          },
        }),
      );
      perBrandUpserted[brandName] = (perBrandUpserted[brandName] || 0) + 1;
    }

    // Run this page's upserts in parallel with a small concurrency cap.
    if (ops.length > 0) {
      await Promise.all(ops);
      totalItemsUpserted += ops.length;
    }

    if (totalPagesFromMeta !== undefined && page >= totalPagesFromMeta) break;
    page++;
  }

  const elapsedSec = (Date.now() - startedAt) / 1000;
  return NextResponse.json({
    success: true,
    done: nextPage === null,
    nextPage, // null when fully done; otherwise the page to resume from
    startPage,
    lastPageProcessed: nextPage !== null ? nextPage - 1 : page,
    totalPagesFromMeta,
    targetBrandCount: targetMap.size,
    targetBrands: Array.from(targetMap.values()).slice(0, 50),
    markupsUpserted,
    totalItemsSeen,
    totalItemsKept,
    totalItemsUpserted,
    perBrandUpserted,
    elapsedSec,
  });
}

// Allow GET for status / dry preview without writes — same response shape
// minus actual page walking. Just confirms which brands intersect.
export async function GET() {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);

  const txt = await fs.readFile(path.join(process.cwd(), 'BRANDS_LIST.txt'), 'utf8');
  const brandsListNames = parseBrandsList(txt);
  const brandsRes = await fetchTurn14Brands();
  const allTurn14Brands: Array<{ id: string; name: string }> = ((brandsRes?.data || []) as any[])
    .map((b): { id: string; name: string } => ({
      id: String(b?.id ?? ''),
      name: ((b?.attributes?.name || b?.name || '') as string).trim(),
    }))
    .filter((b) => b.id && b.name);
  const targetMap = buildTargetMap(brandsListNames, allTurn14Brands);

  return NextResponse.json({
    success: true,
    brandsListCount: brandsListNames.length,
    turn14BrandsCount: allTurn14Brands.length,
    intersectionCount: targetMap.size,
    intersection: Array.from(targetMap.entries()).map(([brandId, brandName]) => ({ brandId, brandName })),
  });
}
