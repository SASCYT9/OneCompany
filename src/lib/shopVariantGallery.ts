/** Keep the product's other views available when a configuration has its own photo. */
export function buildShopVariantGallery(
  productImage: string | null | undefined,
  productGallery: readonly string[] | null | undefined,
  variantImage?: string | null,
): string[] {
  return Array.from(new Set(
    [variantImage, productImage, ...(productGallery ?? [])]
      .filter((image): image is string => typeof image === "string" && image.trim().length > 0)
      .map((image) => image.trim()),
  ));
}
