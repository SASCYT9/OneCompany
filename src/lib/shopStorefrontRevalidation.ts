import { revalidatePath, revalidateTag } from "next/cache";
import {
  buildShopStorefrontRevalidationPlan,
  type RevalidationProduct,
} from "@/lib/shopStorefrontRevalidationPlan";

/** A batch invalidates shared listing paths/tags once, regardless of size. */
export function revalidateShopStorefrontProducts(
  products: readonly RevalidationProduct[],
  detailOnly = false
) {
  const plan = buildShopStorefrontRevalidationPlan(products, detailOnly);
  for (const { path, type } of plan.paths) {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }
  for (const tag of plan.tags) revalidateTag(tag, { expire: 0 });
}

/** Invalidates only the canonical and legacy PDP aliases, never a listing. */
export function revalidateShopStorefrontProductDetail(product: RevalidationProduct) {
  revalidateShopStorefrontProducts([product], true);
}

export function revalidateShopStorefrontProduct(product: RevalidationProduct) {
  revalidateShopStorefrontProducts([product]);
}
