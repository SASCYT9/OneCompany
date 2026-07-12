import { revalidatePath, revalidateTag } from "next/cache";
import {
  buildShopStorefrontProductPath,
  resolveShopStorefrontSegment,
} from "@/lib/shopStorefrontRouting";

const LISTING_SURFACE_BY_SEGMENT = {
  adro: "collections",
  akrapovic: "collections",
  brabus: "products",
  burger: "products",
  csf: "collections",
  do88: "collections",
  girodisc: "catalog",
  ilmberger: "collections",
  ipe: "collections",
  ohlins: "catalog",
  racechip: "catalog",
  urban: "products",
} as const;

const PAGINATED_SEGMENTS = new Set([
  "adro",
  "brabus",
  "burger",
  "csf",
  "girodisc",
  "ipe",
  "ohlins",
  "racechip",
]);

type RevalidationProduct = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
};

export function revalidateShopStorefrontProduct(product: RevalidationProduct) {
  const segment = resolveShopStorefrontSegment(product);

  for (const locale of ["ua", "en"] as const) {
    revalidatePath(buildShopStorefrontProductPath(locale, product));
    revalidatePath(`/${locale}/shop/${product.slug}`);

    if (!segment) continue;
    const surface = LISTING_SURFACE_BY_SEGMENT[segment];
    const basePath = `/${locale}/shop/${segment}/${surface}`;
    revalidatePath(basePath);
    if (PAGINATED_SEGMENTS.has(segment)) {
      revalidatePath(`${basePath}/page/[page]`, "page");
    }
  }

  revalidateTag("shop-products", { expire: 0 });
  if (segment) revalidateTag(`shop-products:${segment}`, { expire: 0 });
}
