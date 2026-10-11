import { memoizeAsyncWithTtl } from "@/lib/asyncTtlMemo";
import { computeRacechipNoindexSlugs } from "@/lib/seoRacechipConsolidation";
import { listShopProductSlugsForSitemap } from "@/lib/shopCatalogServer";

const CACHE_TTL_MS = 10 * 60 * 1000;

// Cached for ten minutes, and concurrent callers share one in-flight load: a
// crawler burst of RaceChip pages on a cold instance would otherwise start one
// full published-product query per request before the first one resolves.
const loadNoindexSlugs = memoizeAsyncWithTtl(async (): Promise<ReadonlySet<string>> => {
  const rows = await listShopProductSlugsForSitemap();
  return computeRacechipNoindexSlugs(rows);
}, CACHE_TTL_MS);

let lastKnownSlugs: ReadonlySet<string> | null = null;

/**
 * RaceChip variants that answer `noindex` and stay out of the sitemap.
 *
 * Built from the same lightweight product list the sitemap uses (cached, a
 * single small query), so the page and the sitemap always agree. Fails open:
 * if the list cannot be read, the last known set is used, or nothing is
 * noindexed when there is none, because wrongly hiding a page from search is
 * worse than listing one duplicate too many.
 */
export async function getRacechipNoindexSlugs(): Promise<ReadonlySet<string>> {
  try {
    const slugs = await loadNoindexSlugs();
    lastKnownSlugs = slugs;
    return slugs;
  } catch (error) {
    console.warn(
      "[seo] RaceChip consolidation unavailable, keeping all variants indexable:",
      error instanceof Error ? error.message : error
    );
    return lastKnownSlugs ?? new Set<string>();
  }
}
