import type { ProformaOrder } from "./orderProforma";

type ProformaItem = ProformaOrder["items"][number];
export type ProformaImageProduct = {
  id: string;
  slug: string;
  image: string | null;
  gallery: unknown;
  media: { src: string }[];
  variants: { id: string; image: string | null }[];
};

export function proformaImageUrl(value: string | null | undefined) {
  const src = value?.trim();
  if (!src || src.includes("\\")) return "";
  try {
    const url = new URL(src, "https://onecompany.global");
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    // Only absolute or root-relative image references are stored in the catalog.
    return src.startsWith("/") || /^https:\/\//i.test(src) ? url.href : "";
  } catch {
    return "";
  }
}

export function proformaImageSources(item: Pick<ProformaItem, "image" | "imageSources">) {
  return Array.from(
    new Set([item.image, ...(item.imageSources ?? [])].map(proformaImageUrl).filter(Boolean))
  ).slice(0, 8);
}

/** Repair document media at read time; never rewrite the order's commercial snapshot. */
export function withProformaImageSources<T extends ProformaOrder>(
  order: T,
  products: ProformaImageProduct[]
): T {
  const byId = new Map(products.map((product) => [product.id, product]));
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return {
    ...order,
    items: order.items.map((item) => {
      // A reused slug must not attach another product's photos to a historic order.
      const product = item.productId ? byId.get(item.productId) : bySlug.get(item.productSlug);
      const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
      const gallery = Array.isArray(product?.gallery)
        ? product.gallery.filter((src): src is string => typeof src === "string")
        : [];
      const imageSources = proformaImageSources({
        image: item.image,
        imageSources: [
          variant?.image ?? "",
          product?.image ?? "",
          ...gallery,
          ...(product?.media.map((media) => media.src) ?? []),
        ],
      });
      return { ...item, image: imageSources[0] ?? null, imageSources };
    }),
  };
}
