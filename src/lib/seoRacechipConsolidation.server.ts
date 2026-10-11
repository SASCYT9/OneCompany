import { unstable_cache } from "next/cache";
import { memoizeAsyncWithTtl } from "@/lib/asyncTtlMemo";
import { computeRacechipNoindexSlugs } from "@/lib/seoRacechipConsolidation";
import { listShopProductSlugsForSitemap } from "@/lib/shopCatalogServer";

/**
 * Every catalog mutation of a RaceChip product already expires this tag (see
 * shopStorefrontRevalidationPlan), so the shared Data Cache entry below is
 * dropped on all instances when group membership can have changed.
 */
const NOINDEX_CACHE_TAG = "shop-products:racechip";
const NOINDEX_CACHE_REVALIDATE_SECONDS = 10 * 60;
// Only absorbs a crawler burst on one instance. The shared cache above decides
// how fresh the set is, so this stays short to bound cross-instance staleness.
const PROCESS_CACHE_TTL_MS = 30 * 1000;

async function queryNoindexSlugs(): Promise<string[]> {
  // Uncached list: the process-local sitemap copy is not shared between
  // instances and would defeat the tag invalidation above.
  const rows = await listShopProductSlugsForSitemap({ fresh: true });
  return [...computeRacechipNoindexSlugs(rows)];
}

const readNoindexSlugs =
  process.env.NODE_ENV === "production"
    ? unstable_cache(queryNoindexSlugs, ["racechip-noindex-slugs-v1"], {
        revalidate: NOINDEX_CACHE_REVALIDATE_SECONDS,
        tags: [NOINDEX_CACHE_TAG],
      })
    : queryNoindexSlugs;

// Concurrent callers share one in-flight load: a crawler burst of RaceChip
// pages on a cold instance would otherwise start one full published-product
// query per request before the first one resolves.
const loadNoindexSlugs = memoizeAsyncWithTtl(
  async (): Promise<ReadonlySet<string>> => new Set(await readNoindexSlugs()),
  PROCESS_CACHE_TTL_MS
);

let lastKnownSlugs: ReadonlySet<string> | null = null;

/**
 * Forget this instance's copy of the consolidation set. Call it after a
 * mutation that can change RaceChip group membership, before the affected
 * pages are revalidated, so their regeneration reads the new set.
 */
export function invalidateRacechipNoindexSlugs() {
  loadNoindexSlugs.reset();
}

/**
 * RaceChip variants that answer `noindex` and stay out of the sitemap.
 *
 * Built from the same lightweight product list the sitemap uses (a single small
 * query), so the page and the sitemap agree. Fails open: if the list cannot be
 * read, the last known set is used, or nothing is noindexed when there is none,
 * because wrongly hiding a page from search is worse than listing one duplicate
 * too many.
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
