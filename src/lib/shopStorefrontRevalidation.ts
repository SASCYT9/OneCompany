import { revalidatePath, revalidateTag } from "next/cache";
import { invalidateRacechipNoindexSlugs } from "@/lib/seoRacechipConsolidation.server";
import {
  affectsRacechipGroups,
  buildRacechipSiblingRevalidationPaths,
  buildShopStorefrontRevalidationPlan,
  type RevalidationProduct,
} from "@/lib/shopStorefrontRevalidationPlan";
import {
  invalidateShopCatalogCaches,
  listShopProductSlugsForSitemap,
} from "@/lib/shopCatalogServer";
import { invalidateShopStockSearchCaches } from "@/lib/shopStockSearch.server";
import { invalidateShopWarehouseProductsCache } from "@/lib/shopWarehouseInventory.server";
import { SHOP_CATALOG_SELECTOR_CACHE_TAG } from "@/lib/shopCatalogSelectorCache";

/**
 * Exactly one RaceChip variant per make/model group is indexable, so a change
 * to one product can flip the robots metadata of its siblings. Their PDPs are
 * ISR pages: revalidate them too, after the consolidation set and the catalog
 * caches are dropped so the regenerated pages read the new group membership.
 * Never rejects; a failure only means the siblings refresh with their normal
 * ISR window.
 */
async function revalidateRacechipGroupSiblings(
  products: readonly RevalidationProduct[],
  alreadyPlanned: ReadonlySet<string>,
  catalogCachesInvalidated: Promise<unknown>
): Promise<void> {
  if (!affectsRacechipGroups(products)) return;
  invalidateRacechipNoindexSlugs();
  try {
    // The member list below must not come from a tagged entry that is still
    // waiting to be invalidated.
    await catalogCachesInvalidated;
    const catalogRows = await listShopProductSlugsForSitemap({ fresh: true });
    for (const path of buildRacechipSiblingRevalidationPaths(
      products,
      catalogRows,
      alreadyPlanned
    )) {
      revalidatePath(path);
    }
  } catch (error) {
    console.warn(
      "[seo] RaceChip sibling revalidation skipped:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * A batch invalidates shared listing paths/tags once, regardless of size.
 *
 * The returned promise settles after the RaceChip sibling pages were
 * revalidated (it never rejects). Route handlers should await it so that work
 * stays inside the request; every other effect has already happened when this
 * function returns.
 */
export function revalidateShopStorefrontProducts(
  products: readonly RevalidationProduct[],
  detailOnly = false
): Promise<void> {
  if (products.length === 0) return Promise.resolve();
  // Next's invalidation APIs do not reach process-local caches, and Accelerate
  // needs an explicit tag invalidation for entries created with a TTL. Start
  // both before path work so a path error cannot leave stale product memory.
  const catalogCachesInvalidated = invalidateShopCatalogCaches();
  invalidateShopStockSearchCaches();
  invalidateShopWarehouseProductsCache();
  const plan = buildShopStorefrontRevalidationPlan(products, detailOnly);
  for (const { path, type } of plan.paths) {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }
  for (const tag of plan.tags) revalidateTag(tag, { expire: 0 });
  // The anonymous warehouse lookup is cached separately from product pages;
  // invalidate it with the same mutation so stock badges reflect edits
  // immediately instead of waiting for the shared 60-second TTL.
  revalidateTag("shop-warehouse-products", { expire: 0 });
  // Product fitment edits and imports change vehicle selector options.
  revalidateTag(SHOP_CATALOG_SELECTOR_CACHE_TAG, { expire: 0 });

  // Price and stock edits never change group membership.
  if (detailOnly) return Promise.resolve();
  return revalidateRacechipGroupSiblings(
    products,
    new Set(plan.paths.map(({ path }) => path)),
    catalogCachesInvalidated
  );
}

/** Invalidates only the canonical and legacy PDP aliases, never a listing. */
export function revalidateShopStorefrontProductDetail(product: RevalidationProduct) {
  return revalidateShopStorefrontProducts([product], true);
}

export function revalidateShopStorefrontProduct(product: RevalidationProduct) {
  return revalidateShopStorefrontProducts([product]);
}
