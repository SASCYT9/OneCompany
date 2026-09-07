import type { ShopProduct } from "@/lib/shopCatalog";
import type { CrossShopGroup, CrossShopMatch } from "@/lib/crossShopFitment";

export type CrossShopCardProduct = Pick<
  ShopProduct,
  "slug" | "title" | "brand" | "vendor" | "tags" | "image" | "price"
>;
export type CrossShopCardMatch = Omit<CrossShopMatch, "product"> & {
  product: CrossShopCardProduct;
};
export type CrossShopCardGroup = Omit<CrossShopGroup, "matches"> & {
  matches: CrossShopCardMatch[];
};

/** Run on the server before the client boundary. Recommendation cards do not
 * render descriptions, galleries or variants; these must not inflate the RSC
 * response and ISR cache for every product page.
 */
export function projectCrossShopRecommendationCards(
  groups: CrossShopGroup[]
): CrossShopCardGroup[] {
  return groups.map((group) => ({
    ...group,
    matches: group.matches.map((match) => {
      const { slug, title, brand, vendor, tags, image, price } = match.product;
      return { ...match, product: { slug, title, brand, vendor, tags, image, price } };
    }),
  }));
}
