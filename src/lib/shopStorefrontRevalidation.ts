import { revalidatePath, revalidateTag } from "next/cache";
import {
  buildShopStorefrontRevalidationPlan,
  type RevalidationProduct,
} from "@/lib/shopStorefrontRevalidationPlan";
import { invalidateShopCatalogCaches } from "@/lib/shopCatalogServer";
import { invalidateShopWarehouseProductsCache } from "@/lib/shopWarehouseInventory.server";

/** A batch invalidates shared listing paths/tags once, regardless of size. */
export function revalidateShopStorefrontProducts(
  products: readonly RevalidationProduct[],
  detailOnly = false
) {
  if (products.length === 0) return;
  // Next's invalidation APIs do not reach process-local caches, and Accelerate
  // needs an explicit tag invalidation for entries created with a TTL. Start
  // both before path work so a path error cannot leave stale product memory.
  void invalidateShopCatalogCaches();
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
}

/** Invalidates only the canonical and legacy PDP aliases, never a listing. */
export function revalidateShopStorefrontProductDetail(product: RevalidationProduct) {
  revalidateShopStorefrontProducts([product], true);
}

export function revalidateShopStorefrontProduct(product: RevalidationProduct) {
  revalidateShopStorefrontProducts([product]);
}
