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
  /** Diagnostics — populated to help triage match failures. */
  debug?: {
    turn14ItemMapSize?: number;
    turn14SampleKeys?: string[];
    turn14SamplePartPairs?: Array<{ partNumber: string; mfrPartNumber: string | null }>;
    /** Up to 8 Turn14 brands whose name shares any token with the requested brand. */
    turn14CandidateBrands?: Array<{ id: string; name: string }>;
    /** How many /v1/items pages we walked. */
    turn14PagesWalked?: number;
    /** How many raw items came back across those pages. */
    turn14ItemCount?: number;
    /** Distribution of attributes.brand_name across returned items. If
     * brand_id is filtering correctly there should be exactly one key. */
    turn14BrandNameDistribution?: Record<string, number>;
    /** Where the item map came from: local Turn14Item cache, live API, or empty. */
    turn14ItemSource?: 'local' | 'api' | 'empty';
  };
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
 * We always fetch /v1/brands (one cached call) so we can verify whatever
 * `brandId` the local markup table claims. Without verification, a stale
 * row in `Turn14BrandMarkup` can point at a brandId that Turn14 silently
 * ignores — and Turn14's `/v1/items?brand_id=X` returns the *whole*
 * catalog when X is unknown, which we observed as 5991 mixed-supplier
 * items for what should be a ~150-item brand.
 *
 * Strategy:
 *   1. Markup row exists AND its brandId resolves to the same name on
 *      Turn14 (case-insensitive) → trust the markup.
 *   2. Otherwise, try exact case-insensitive name match.
 *   3. Otherwise, try substring match either direction (handles e.g.
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

  await turn14Throttle();
  const res = await fetchTurn14Brands();
  const items: any[] = res?.data || (Array.isArray(res) ? res : []);
  const named = items.map((b) => ({
    id: String(b?.id ?? ''),
    name: ((b?.attributes?.name || b?.name || '') as string).trim(),
  }));
  const namedById = new Map<string, { id: string; name: string }>(named.map((n) => [n.id, n]));

  // 1. Local mapping — but only if Turn14 still names that brandId the same.
  const local = await prisma.turn14BrandMarkup.findFirst({
    where: { brandName: { equals: trimmed, mode: 'insensitive' } },
    select: { brandId: true },
  });
  if (local?.brandId) {
    const canonical = namedById.get(local.brandId);
    if (canonical && canonical.name.toLowerCase() === lower) {
      return local.brandId;
    }
    // Stale or wrong markup — fall through to name-based lookup so we don't
    // ship products to the wrong brand_id and pull the entire Turn14 catalog.
  }

  // 2. Exact case-insensitive match against the canonical list.
  const exact = named.find((b) => b.name.toLowerCase() === lower);
  if (exact?.id) return exact.id;

  // 3. Substring match either direction (covers naming drift).
  const substring = named.find((b) => {
    const n = b.name.toLowerCase();
    return n.length > 0 && (n.includes(lower) || lower.includes(n));
  });
  return substring?.id ?? null;
}

interface BrandItemMapEntry {
  id: string;
  partNumber: string;
  mfrPartNumber: string | null;
  /** Cached `attributes` blob from local Turn14Item, when available. Lets us
   * read `dimensions` without an extra Turn14 detail fetch. */
  attributes?: any;
}

interface BrandItemMapResult {
  map: Map<string, BrandItemMapEntry>;
  source: 'local' | 'api' | 'empty';
  pagesWalked: number;
  itemCount: number;
  /** Distribution of brand_name as reported by Turn14 in attributes. */
  brandNameDistribution: Record<string, number>;
}

function indexEntry(
  map: Map<string, BrandItemMapEntry>,
  entry: BrandItemMapEntry,
) {
  if (entry.partNumber) map.set(entry.partNumber.toUpperCase(), entry);
  if (entry.mfrPartNumber) map.set(entry.mfrPartNumber.toUpperCase(), entry);
}

/**
 * Build a SKU/MPN -> Turn14 item map for a single brand.
 *
 * Strategy:
 *   1. Try the local `Turn14Item` table (populated by /api/admin/turn14-sync).
 *      Fast, free, and already brand-filtered correctly (the catalog sync
 *      post-filters items by `attributes.brand_id` because Turn14's
 *      /v1/items?brand_id=X is known to return the full catalog when X
 *      doesn't filter). Each cached row carries `attributes` so we can
 *      read `dimensions` without a Turn14 detail call.
 *   2. Fall back to the live /v1/items API with the same post-filter:
 *      drop items whose `attributes.brand_id` doesn't match. Throttled
 *      to ~4 req/s. Used when the local cache is empty for this brand.
 */
async function buildBrandItemMap(
  prisma: PrismaClient,
  turn14BrandId: string,
  maxPagesPerBrand: number,
): Promise<BrandItemMapResult> {
  const map = new Map<string, BrandItemMapEntry>();
  const brandNameDistribution: Record<string, number> = {};

  // 1. Local cache via Turn14Item.
  const localItems = await prisma.turn14Item.findMany({
    where: { brandId: turn14BrandId },
    select: {
      id: true,
      partNumber: true,
      attributes: true,
    },
    take: 5000,
  });
  if (localItems.length > 0) {
    for (const it of localItems) {
      const attrs = (it.attributes ?? {}) as any;
      const partNumber: string = it.partNumber || attrs.part_number || '';
      const mfrPartNumber: string | null = attrs.mfr_part_number || null;
      const brandName: string = attrs.brand_name || attrs.brand || '<unknown>';
      indexEntry(map, { id: it.id, partNumber, mfrPartNumber, attributes: attrs });
      brandNameDistribution[brandName.trim()] = (brandNameDistribution[brandName.trim()] || 0) + 1;
    }
    return { map, source: 'local', pagesWalked: 0, itemCount: localItems.length, brandNameDistribution };
  }

  // 2. Live Turn14 API fallback with post-filter.
  let page = 1;
  let pagesWalked = 0;
  let itemCount = 0;
  while (page <= maxPagesPerBrand) {
    await turn14Throttle();
    const body = await fetchTurn14ItemsByBrand(turn14BrandId, page);
    const items: any[] = body?.data || [];
    pagesWalked++;
    if (items.length === 0) break;
    for (const it of items) {
      const attrs = it?.attributes || {};
      const itemBrandId = attrs.brand_id !== undefined ? String(attrs.brand_id) : null;
      const brandName = (attrs.brand_name || attrs.brand || '<none>').toString().trim();
      brandNameDistribution[brandName] = (brandNameDistribution[brandName] || 0) + 1;
      itemCount++;
      // Skip items whose Turn14 brand_id doesn't match (Turn14 frequently
      // returns the global catalog when its brand_id filter is bogus).
      if (itemBrandId && itemBrandId !== turn14BrandId) continue;
      const partNumber: string | undefined = attrs.part_number;
      const mfrPartNumber: string | undefined = attrs.mfr_part_number;
      indexEntry(map, {
        id: String(it.id),
        partNumber: partNumber || '',
        mfrPartNumber: mfrPartNumber || null,
        attributes: attrs,
      });
    }
    const totalPages = body?.meta?.total_pages;
    if (typeof totalPages === 'number' && page >= totalPages) break;
    page++;
  }
  return {
    map,
    source: map.size > 0 ? 'api' : 'empty',
    pagesWalked,
    itemCount,
    brandNameDistribution,
  };
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

  // Collect Turn14 brand candidates whose name shares any token with our
  // brand — surfaces stale-mapping situations where the markup table
  // points at the wrong brandId. Cheap one extra fetch (cached server-side).
  try {
    await turn14Throttle();
    const brandsRes = await fetchTurn14Brands();
    const brandList: any[] = brandsRes?.data || (Array.isArray(brandsRes) ? brandsRes : []);
    const ourTokens = options.brandName.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
    const candidates: Array<{ id: string; name: string }> = [];
    for (const b of brandList) {
      const id = String(b?.id ?? '');
      const name = ((b?.attributes?.name || b?.name || '') as string).trim();
      if (!id || !name) continue;
      const lc = name.toLowerCase();
      if (ourTokens.some((t) => lc.includes(t)) || lc.includes(options.brandName.toLowerCase())) {
        candidates.push({ id, name });
        if (candidates.length >= 8) break;
      }
    }
    if (candidates.length > 0) {
      result.debug = { ...(result.debug ?? { turn14ItemMapSize: 0, turn14SampleKeys: [], turn14SamplePartPairs: [] }), turn14CandidateBrands: candidates };
    }
  } catch {
    // best-effort diagnostic, never fail the main flow
  }

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

  // 3. Build SKU map for this brand — local cache first, Turn14 API fallback
  const { map: itemMap, source, pagesWalked, itemCount, brandNameDistribution } =
    await buildBrandItemMap(prisma, turn14BrandId, maxPagesPerBrand);

  // Stash a small diagnostic sample so we can see why matches fail.
  const seenIds = new Set<string>();
  const samplePartPairs: Array<{ partNumber: string; mfrPartNumber: string | null }> = [];
  for (const entry of itemMap.values()) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    samplePartPairs.push({ partNumber: entry.partNumber, mfrPartNumber: entry.mfrPartNumber });
    if (samplePartPairs.length >= 10) break;
  }
  result.debug = {
    ...(result.debug ?? {}),
    turn14ItemMapSize: itemMap.size,
    turn14SampleKeys: Array.from(itemMap.keys()).slice(0, 10),
    turn14SamplePartPairs: samplePartPairs,
    turn14PagesWalked: pagesWalked,
    turn14ItemCount: itemCount,
    turn14BrandNameDistribution: brandNameDistribution,
    turn14ItemSource: source,
  };

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
      // 1. Exact + prefix-strip: try the SKU as-is, then progressively strip
      //    leading dash-prefixed segments. Covers shop SKUs that prepend
      //    their own prefix ("OC-BMS-JB4-B58" → "BMS-JB4-B58" → "JB4-B58").
      const candidates: string[] = [];
      let remaining = sku;
      candidates.push(remaining);
      let safety = 4;
      while (safety-- > 0) {
        const dashIdx = remaining.indexOf('-');
        if (dashIdx <= 0 || dashIdx >= remaining.length - 1) break;
        remaining = remaining.slice(dashIdx + 1);
        candidates.push(remaining);
      }
      for (const candidate of candidates) {
        const entry = itemMap.get(candidate);
        if (entry) {
          t14ItemId = entry.id;
          break;
        }
      }

      // 2. Suffix-match fallback. Covers the opposite shape: shop holds the
      //    clean MFR part number (e.g. "A1-163") while Turn14 prefixed it
      //    with the supplier code (e.g. "GIR-A1-163"). Walk the item map and
      //    find a Turn14 key that ends with the shop SKU. We require >=4
      //    characters to avoid promiscuous matches like a 2-char SKU "B1"
      //    matching dozens of unrelated Turn14 items.
      if (!t14ItemId && sku.length >= 4) {
        const sep = '-';
        let suffixHit: { id: string; key: string } | null = null;
        let ambiguous = false;
        for (const [key, entry] of itemMap) {
          if (key === sku) continue; // already covered by exact above
          if (!key.endsWith(sku)) continue;
          // Require a separator boundary to avoid matching deep into a token
          // (e.g. shop "B58" should NOT match Turn14 "ABCB58"). Either the
          // matched portion starts at index 0 or is preceded by a dash.
          const startIdx = key.length - sku.length;
          if (startIdx > 0 && key[startIdx - 1] !== sep) continue;
          if (suffixHit && suffixHit.id !== entry.id) {
            ambiguous = true;
            break;
          }
          suffixHit = { id: entry.id, key };
        }
        if (suffixHit && !ambiguous) t14ItemId = suffixHit.id;
      }
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

    // 5. Read dimensions — prefer the cached attributes blob from the
    //    item map (covers the local-cache path with zero extra API calls);
    //    fall back to a throttled Turn14 detail fetch when the cached
    //    attributes don't carry dimensions.
    const matchedEntry = sku ? itemMap.get(sku) : null;
    let attrs: any = matchedEntry?.attributes ?? null;
    let dims = attrs?.dimensions;
    if (!Array.isArray(dims) || dims.length === 0) {
      try {
        await turn14Throttle();
        const detail = await fetchTurn14ItemDetail(t14ItemId);
        attrs = detail?.data?.attributes ?? null;
        dims = attrs?.dimensions;
      } catch (err) {
        result.unmatched.push({
          variantId: variant.id,
          sku: variant.sku,
          reason: `Turn14 detail fetch failed: ${(err as Error).message}`,
        });
        continue;
      }
    }
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
 * List ShopProduct distinct brands enriched with Turn14 mapping info.
 *
 * `turn14BrandId` is non-null when the brand has a row in `Turn14BrandMarkup`
 * (the existing local mapping populated by the markups admin UI). This lets
 * the operator instantly see which shop brands are syncable via Turn14
 * without trial-and-error.
 *
 * Brands without a markup row are NOT hidden — the sync path still tries an
 * exact + substring match against the live Turn14 brands list, so the
 * operator can attempt them. The badge is just a hint about confidence.
 */
export async function listShopBrands(
  prisma: PrismaClient,
): Promise<Array<{ brand: string; productCount: number; turn14BrandId: string | null }>> {
  const [rows, markups] = await Promise.all([
    prisma.shopProduct.groupBy({
      by: ['brand'],
      _count: { _all: true },
      where: { brand: { not: null } },
    }),
    prisma.turn14BrandMarkup.findMany({ select: { brandId: true, brandName: true } }),
  ]);
  const markupByName = new Map<string, string>();
  for (const m of markups) {
    if (m.brandName) markupByName.set(m.brandName.trim().toLowerCase(), m.brandId);
  }
  return rows
    .filter((r) => r.brand && r.brand.trim().length > 0)
    .map((r) => ({
      brand: r.brand as string,
      productCount: r._count._all,
      turn14BrandId: markupByName.get(r.brand!.trim().toLowerCase()) ?? null,
    }))
    .sort((a, b) => {
      // Turn14-mapped brands first, then by product count desc, then alphabetical.
      const aIn = a.turn14BrandId !== null ? 1 : 0;
      const bIn = b.turn14BrandId !== null ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      return b.productCount - a.productCount || a.brand.localeCompare(b.brand);
    });
}
