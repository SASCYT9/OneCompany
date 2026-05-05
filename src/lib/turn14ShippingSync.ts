/**
 * Turn14 SHIPPING-DATA-ONLY sync.
 *
 * HARD RULE: this module must NEVER overwrite product content
 * (titleEn, titleUa, longDesc*, image, media). It only writes:
 *   weight, length, width, height, grams, isDimensionsEstimated.
 *
 * Defaults to dry-run. Pass `apply: true` to actually mutate the DB.
 *
 * Scope: brand-by-brand. Caller chooses which brand(s) to sync, and we
 * only iterate Turn14 items belonging to that brand. We never iterate
 * the full Turn14 catalog.
 */

import { PrismaClient } from '@prisma/client';
import {
  fetchTurn14Brands,
  fetchTurn14ItemsByBrand,
  fetchTurn14ItemDetail,
} from './turn14';

const LBS_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

export interface ShippingDims {
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

export interface SyncBrandShippingResult {
  brandName: string;
  turn14BrandId: string | null;
  variantsScanned: number;
  variantsMatched: number;
  variantsUpdated: number;
  variantsSkippedAlreadyHave: number;
  variantsNoTurn14Match: number;
  variantsNoDimsInTurn14: number;
  perplexityFallbackQueued: number;
  changes: Array<{
    variantId: string;
    sku: string | null;
    productTitle: string;
    before: ShippingDims;
    after: ShippingDims;
    source: 'turn14' | 'perplexity';
  }>;
  unmatched: Array<{ variantId: string; sku: string | null; reason: string }>;
  dryRun: boolean;
  durationMs: number;
}

export interface SyncBrandShippingOptions {
  /** Exact ShopProduct.brand value to scope to (case-insensitive Turn14 lookup). */
  brandName: string;
  /**
   * Set to `true` to actually write to DB. Defaults to false (dry-run).
   * Dry-run still calls Turn14 read APIs but does not mutate anything.
   */
  apply?: boolean;
  /** Hard cap on variants processed in this run (safety). Default: 500. */
  maxVariants?: number;
  /** Cap on Turn14 pages walked per brand. Default: 25 (500 items). */
  maxPagesPerBrand?: number;
  /**
   * If true, also re-sync variants that already have all dimensions.
   * Defaults to false — we only fill missing data.
   */
  refreshExisting?: boolean;
}

/**
 * Convert raw Turn14 dimensions[0] to metric.
 * Returns null fields where source data is missing/zero/invalid.
 */
function toMetric(dim: {
  weight?: unknown;
  length?: unknown;
  width?: unknown;
  height?: unknown;
} | undefined): ShippingDims {
  if (!dim) return { weightKg: null, lengthCm: null, widthCm: null, heightCm: null };
  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const wLb = num(dim.weight);
  const lIn = num(dim.length);
  const wIn = num(dim.width);
  const hIn = num(dim.height);
  return {
    weightKg: wLb !== null ? round3(wLb * LBS_TO_KG) : null,
    lengthCm: lIn !== null ? round3(lIn * IN_TO_CM) : null,
    widthCm: wIn !== null ? round3(wIn * IN_TO_CM) : null,
    heightCm: hIn !== null ? round3(hIn * IN_TO_CM) : null,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function hasAllDims(d: ShippingDims): boolean {
  return d.weightKg !== null && d.lengthCm !== null && d.widthCm !== null && d.heightCm !== null;
}

function hasAnyDim(d: ShippingDims): boolean {
  return d.weightKg !== null || d.lengthCm !== null || d.widthCm !== null || d.heightCm !== null;
}

/**
 * Stay safely under Turn14's 5 req/s rate limit. We aim for ~4 req/s by
 * sleeping 250 ms between consecutive Turn14 calls in this module.
 */
const TURN14_REQ_INTERVAL_MS = 260;
let lastTurn14CallAt = 0;
async function turn14Throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastTurn14CallAt + TURN14_REQ_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastTurn14CallAt = Date.now();
}

/**
 * Resolve a Turn14 `brand_id` for a given ShopProduct brand string.
 *
 * Strategy (cheapest → most expensive):
 *   1. Local mapping in `Turn14BrandMarkup` (case-insensitive). This table
 *      is already populated by the markup management UI; if a brand has
 *      ever been priced/synced, its `brandId` is here.
 *   2. Turn14 `/v1/brands` API — exact case-insensitive match.
 *   3. Turn14 `/v1/brands` API — substring match (handles cases like
 *      "Burger Motorsports" in shop vs "Burger Tuning" in Turn14).
 *
 * Returns null if no match.
 */
export async function resolveTurn14BrandId(
  prisma: PrismaClient,
  brandName: string,
): Promise<string | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  // 1. Local mapping table.
  const local = await prisma.turn14BrandMarkup.findFirst({
    where: { brandName: { equals: trimmed, mode: 'insensitive' } },
    select: { brandId: true },
  });
  if (local?.brandId) return local.brandId;

  // 2 + 3. Fall back to Turn14 brands list.
  await turn14Throttle();
  const res = await fetchTurn14Brands();
  const items: any[] = res?.data || (Array.isArray(res) ? res : []);
  const named = items.map((b) => ({
    id: String(b?.id ?? ''),
    name: ((b?.attributes?.name || b?.name || '') as string).trim(),
  }));

  const exact = named.find((b) => b.name.toLowerCase() === lower);
  if (exact?.id) return exact.id;

  const substring = named.find((b) => {
    const n = b.name.toLowerCase();
    return n.length > 0 && (n.includes(lower) || lower.includes(n));
  });
  return substring?.id ?? null;
}

/**
 * Build a SKU/MPN -> turn14ItemId map for a single brand by walking all
 * pages of /v1/items?brand_id={id}. Limited by maxPagesPerBrand.
 *
 * Throttled to ~4 req/s (Turn14 caps at 5).
 */
async function buildBrandItemMap(
  turn14BrandId: string,
  maxPagesPerBrand: number,
): Promise<Map<string, { id: string; partNumber: string; mfrPartNumber: string | null }>> {
  const map = new Map<string, { id: string; partNumber: string; mfrPartNumber: string | null }>();
  let page = 1;
  while (page <= maxPagesPerBrand) {
    await turn14Throttle();
    const body = await fetchTurn14ItemsByBrand(turn14BrandId, page);
    const items: any[] = body?.data || [];
    if (items.length === 0) break;
    for (const it of items) {
      const attrs = it?.attributes || {};
      const partNumber: string | undefined = attrs.part_number;
      const mfrPartNumber: string | undefined = attrs.mfr_part_number;
      const entry = { id: String(it.id), partNumber: partNumber || '', mfrPartNumber: mfrPartNumber || null };
      if (partNumber) map.set(partNumber.toUpperCase(), entry);
      if (mfrPartNumber) map.set(mfrPartNumber.toUpperCase(), entry);
    }
    const totalPages = body?.meta?.total_pages;
    if (typeof totalPages === 'number' && page >= totalPages) break;
    page++;
  }
  return map;
}

/**
 * Sync shipping data (weight + L/W/H) for ALL ShopProductVariants belonging
 * to ShopProducts of the given brand. Defaults to dry-run.
 *
 * Does NOT write any non-shipping fields.
 */
export async function syncBrandShippingData(
  prisma: PrismaClient,
  options: SyncBrandShippingOptions,
): Promise<SyncBrandShippingResult> {
  const start = Date.now();
  const dryRun = options.apply !== true;
  const maxVariants = options.maxVariants ?? 500;
  const maxPagesPerBrand = options.maxPagesPerBrand ?? 25;
  const refreshExisting = options.refreshExisting === true;

  const result: SyncBrandShippingResult = {
    brandName: options.brandName,
    turn14BrandId: null,
    variantsScanned: 0,
    variantsMatched: 0,
    variantsUpdated: 0,
    variantsSkippedAlreadyHave: 0,
    variantsNoTurn14Match: 0,
    variantsNoDimsInTurn14: 0,
    perplexityFallbackQueued: 0,
    changes: [],
    unmatched: [],
    dryRun,
    durationMs: 0,
  };

  // 1. Resolve Turn14 brand
  const turn14BrandId = await resolveTurn14BrandId(prisma, options.brandName);
  result.turn14BrandId = turn14BrandId;
  if (!turn14BrandId) {
    result.durationMs = Date.now() - start;
    return result;
  }

  // 2. Find variants for this brand in our DB
  const variants = await prisma.shopProductVariant.findMany({
    where: {
      product: { brand: { equals: options.brandName, mode: 'insensitive' } },
    },
    select: {
      id: true,
      sku: true,
      weight: true,
      length: true,
      width: true,
      height: true,
      grams: true,
      isDimensionsEstimated: true,
      turn14Id: true,
      product: { select: { id: true, titleEn: true, titleUa: true, brand: true } },
    },
    take: maxVariants,
  });
  result.variantsScanned = variants.length;
  if (variants.length === 0) {
    result.durationMs = Date.now() - start;
    return result;
  }

  // 3. Build SKU map for this brand from Turn14
  const itemMap = await buildBrandItemMap(turn14BrandId, maxPagesPerBrand);

  // 4. Iterate variants
  for (const variant of variants) {
    const currentDims: ShippingDims = {
      weightKg: variant.weight ?? null,
      lengthCm: variant.length ?? null,
      widthCm: variant.width ?? null,
      heightCm: variant.height ?? null,
    };

    if (!refreshExisting && hasAllDims(currentDims)) {
      result.variantsSkippedAlreadyHave++;
      continue;
    }

    const sku = variant.sku?.toUpperCase() || null;
    let t14ItemId: string | null = variant.turn14Id ?? null;
    if (!t14ItemId && sku) {
      const entry = itemMap.get(sku);
      if (entry) t14ItemId = entry.id;
    }

    if (!t14ItemId) {
      result.variantsNoTurn14Match++;
      result.unmatched.push({
        variantId: variant.id,
        sku: variant.sku,
        reason: 'no Turn14 item matched by sku/mpn for this brand',
      });
      result.perplexityFallbackQueued++;
      continue;
    }

    result.variantsMatched++;

    // 5. Fetch detail to read dimensions (throttled)
    let detail: any = null;
    try {
      await turn14Throttle();
      detail = await fetchTurn14ItemDetail(t14ItemId);
    } catch (err) {
      result.unmatched.push({
        variantId: variant.id,
        sku: variant.sku,
        reason: `Turn14 detail fetch failed: ${(err as Error).message}`,
      });
      continue;
    }
    const dims = detail?.data?.attributes?.dimensions;
    const firstDim = Array.isArray(dims) ? dims[0] : null;
    const newDims = toMetric(firstDim);

    if (!hasAnyDim(newDims)) {
      result.variantsNoDimsInTurn14++;
      result.perplexityFallbackQueued++;
      continue;
    }

    // 6. Decide what to write — only fields where the source has data AND
    //    the variant is missing it (or refreshExisting is true).
    const writePayload: {
      weight?: number;
      length?: number;
      width?: number;
      height?: number;
      grams?: number;
      isDimensionsEstimated?: boolean;
    } = {};
    if (newDims.weightKg !== null && (refreshExisting || currentDims.weightKg === null)) {
      writePayload.weight = newDims.weightKg;
      writePayload.grams = Math.round(newDims.weightKg * 1000);
    }
    if (newDims.lengthCm !== null && (refreshExisting || currentDims.lengthCm === null)) {
      writePayload.length = newDims.lengthCm;
    }
    if (newDims.widthCm !== null && (refreshExisting || currentDims.widthCm === null)) {
      writePayload.width = newDims.widthCm;
    }
    if (newDims.heightCm !== null && (refreshExisting || currentDims.heightCm === null)) {
      writePayload.height = newDims.heightCm;
    }

    if (Object.keys(writePayload).length === 0) {
      result.variantsSkippedAlreadyHave++;
      continue;
    }

    // Direct from Turn14 = authoritative, not estimated
    writePayload.isDimensionsEstimated = false;
    // Stash the Turn14 item id so we don't have to re-resolve next time
    if (!variant.turn14Id) {
      // We deliberately do not set turn14Id here unless apply=true, since
      // it touches identity columns. Skip for dry-run.
    }

    result.changes.push({
      variantId: variant.id,
      sku: variant.sku,
      productTitle: variant.product.titleUa || variant.product.titleEn || '(untitled)',
      before: currentDims,
      after: {
        weightKg: writePayload.weight ?? currentDims.weightKg,
        lengthCm: writePayload.length ?? currentDims.lengthCm,
        widthCm: writePayload.width ?? currentDims.widthCm,
        heightCm: writePayload.height ?? currentDims.heightCm,
      },
      source: 'turn14',
    });

    if (!dryRun) {
      const updateData = { ...writePayload } as Record<string, unknown>;
      if (!variant.turn14Id) updateData.turn14Id = t14ItemId;
      await prisma.shopProductVariant.update({
        where: { id: variant.id },
        data: updateData as any,
      });
      result.variantsUpdated++;
    }
  }

  result.durationMs = Date.now() - start;
  return result;
}

/**
 * List ShopProduct distinct brands. Useful for the admin UI to populate a
 * dropdown so we never sync brands not present in the shop.
 */
export async function listShopBrands(prisma: PrismaClient): Promise<Array<{ brand: string; productCount: number }>> {
  const rows = await prisma.shopProduct.groupBy({
    by: ['brand'],
    _count: { _all: true },
    where: { brand: { not: null } },
  });
  return rows
    .filter((r) => r.brand && r.brand.trim().length > 0)
    .map((r) => ({ brand: r.brand as string, productCount: r._count._all }))
    .sort((a, b) => b.productCount - a.productCount || a.brand.localeCompare(b.brand));
}
