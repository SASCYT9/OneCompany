import { legacyProductSlugCandidates } from "@/lib/legacyProductSlugs";
import { getShopProductBySlugServer } from "@/lib/shopCatalogServer";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";

/**
 * Canonical path of the product a renamed legacy slug now points to, or null
 * when the slug is simply unknown. Only runs on the not-found path, and every
 * candidate is checked against the catalog before anything redirects.
 */
export async function resolveLegacyProductPath(
  locale: string,
  slug: string
): Promise<string | null> {
  for (const candidate of legacyProductSlugCandidates(slug)) {
    const product = await getShopProductBySlugServer(candidate);
    if (product) return buildShopStorefrontProductPathForProduct(locale, product);
  }
  return null;
}
