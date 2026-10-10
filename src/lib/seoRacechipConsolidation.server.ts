import { computeRacechipNoindexSlugs } from "@/lib/seoRacechipConsolidation";
import { listShopProductSlugsForSitemap } from "@/lib/shopCatalogServer";

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { slugs: ReadonlySet<string>; ts: number } | null = null;

/**
 * RaceChip variants that answer `noindex` and stay out of the sitemap.
 *
 * Built from the same lightweight product list the sitemap uses (cached, a
 * single small query), so the page and the sitemap always agree. Fails open:
 * if the list cannot be read, nothing is noindexed, because wrongly hiding a
 * page from search is worse than listing one duplicate too many.
 */
export async function getRacechipNoindexSlugs(): Promise<ReadonlySet<string>> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.slugs;

  try {
    const rows = await listShopProductSlugsForSitemap();
    const slugs = computeRacechipNoindexSlugs(rows);
    cache = { slugs, ts: now };
    return slugs;
  } catch (error) {
    console.warn(
      "[seo] RaceChip consolidation unavailable, keeping all variants indexable:",
      error instanceof Error ? error.message : error
    );
    return cache?.slugs ?? new Set<string>();
  }
}
