import type { ShopProduct } from "@/lib/shopCatalog";
import {
  extractProductFitment,
  isExcludedFromCrossShop,
  type Fitment,
} from "@/lib/crossShopFitment";
import { findCrossShopFitmentMatches } from "@/lib/crossShopFitment.server";
import type { CrossShopCardGroup } from "@/lib/crossShopRecommendationCard";
import {
  getShopRecommendationProductsForFitmentServer,
  getShopRecommendationProductsServer,
} from "@/lib/shopCatalogServer";
import {
  isShopCatalogReaderRequestEnabled,
  resolveShopCatalogReaderFlag,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";

export type CrossShopRecommendations = {
  fitment: Fitment;
  groups: CrossShopCardGroup[];
};

/**
 * "Fits your car from other brands" cards for one product: public catalog
 * card data only, personalized pricing stays in the client. Shared by the
 * product page (server-rendered block) and `/api/shop/recommendations`.
 */
export async function loadCrossShopRecommendations(
  product: ShopProduct,
  canaryHeader?: string | null
): Promise<CrossShopRecommendations> {
  const fitment = extractProductFitment(product);
  const canRecommend =
    !isExcludedFromCrossShop(product) && Boolean(fitment.make || fitment.chassisCodes.length);
  if (!canRecommend) return { fitment, groups: [] };

  const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
  const candidates = isShopCatalogReaderRequestEnabled(reader, canaryHeader)
    ? await getShopRecommendationProductsForFitmentServer(fitment, product.id)
    : await getShopRecommendationProductsServer();
  const groups = findCrossShopFitmentMatches(product, candidates, {
    perBrand: 3,
    totalLimit: 24,
  });
  return { fitment, groups };
}

/**
 * For the server-rendered product page block: a failed read must never break
 * the product page. `null` lets the block fall back to loading on scroll.
 * Only the projection reader (one bounded query per product) runs inside the
 * page render; the legacy reader iterates the full catalog, so it stays on
 * the client-triggered API path.
 */
export async function loadCrossShopRecommendationsSafely(
  product: ShopProduct
): Promise<CrossShopRecommendations | null> {
  const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
  if (!isShopCatalogReaderRequestEnabled(reader, null)) return null;
  try {
    const result = await loadCrossShopRecommendations(product);
    return result.groups.length ? result : null;
  } catch (error) {
    console.error({
      event: "cross_shop_recommendations_failed",
      slug: product.slug,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}
