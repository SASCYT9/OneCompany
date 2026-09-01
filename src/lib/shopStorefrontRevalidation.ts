import { revalidatePath, revalidateTag } from "next/cache";
import {
  buildShopStorefrontProductPath,
  resolveShopStorefrontSegment,
} from "@/lib/shopStorefrontRouting";
import { getStorefrontRoute } from "@/lib/storefrontRouteRegistry";

type RevalidationProduct = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
};

/** Invalidates only the canonical and legacy PDP aliases, never a listing. */
export function revalidateShopStorefrontProductDetail(product: RevalidationProduct) {
  for (const locale of ["ua", "en"] as const) {
    revalidatePath(buildShopStorefrontProductPath(locale, product));
    revalidatePath(`/${locale}/shop/${product.slug}`);
  }
}

export function revalidateShopStorefrontProduct(product: RevalidationProduct) {
  const segment = resolveShopStorefrontSegment(product);
  revalidateShopStorefrontProductDetail(product);

  for (const locale of ["ua", "en"] as const) {
    if (!segment) continue;
    const route = getStorefrontRoute(segment);
    const basePath = `/${locale}/shop/${segment}/${route.listingSurface}`;
    revalidatePath(basePath);
    if (route.paginated) {
      revalidatePath(`${basePath}/page/[page]`, "page");
    }
  }

  revalidateTag("shop-products", { expire: 0 });
  if (segment) revalidateTag(`shop-products:${segment}`, { expire: 0 });
}
