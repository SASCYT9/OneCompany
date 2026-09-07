import {
  buildShopStorefrontProductPath,
  resolveShopStorefrontSegment,
} from "@/lib/shopStorefrontRouting";
import { getStorefrontRoute } from "@/lib/storefrontRouteRegistry";

export type RevalidationProduct = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
};

export function buildShopStorefrontRevalidationPlan(
  products: readonly RevalidationProduct[],
  detailOnly = false
) {
  const paths = new Map<string, { path: string; type?: "page" }>();
  const tags = new Set<string>();
  const add = (path: string, type?: "page") => paths.set(`${type ?? ""}:${path}`, { path, type });
  for (const product of products) {
    const segment = resolveShopStorefrontSegment(product);
    for (const locale of ["ua", "en"] as const) {
      add(buildShopStorefrontProductPath(locale, product));
      add(`/${locale}/shop/${product.slug}`);
      if (detailOnly || !segment) continue;
      const route = getStorefrontRoute(segment);
      const basePath = `/${locale}/shop/${segment}/${route.listingSurface}`;
      add(basePath);
      if (route.paginated) add(`${basePath}/page/[page]`, "page");
    }
    if (!detailOnly) {
      tags.add("shop-products");
      if (segment) tags.add(`shop-products:${segment}`);
    }
  }
  return { paths: [...paths.values()], tags: [...tags] };
}
