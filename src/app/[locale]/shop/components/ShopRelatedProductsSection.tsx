import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { SupportedLocale } from "@/lib/seo";
import { getShopRelatedProductsByBrandServer } from "@/lib/shopCatalogServer";
import type { ShopProduct } from "@/lib/shopCatalog";
import {
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";
import { localizeShopProductTitle } from "@/lib/shopText";
import { findRelatedProducts } from "@/lib/shopRelatedProducts";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { ShopInlinePriceText } from "@/components/shop/ShopInlinePriceText";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import {
  isWheelForceWheel,
  isWheelForceWheelSet,
  wheelForceSetMoney,
  WHEELFORCE_FAMILY_CHILD_TAG,
} from "@/lib/wheelforceFamily";

function normalizeImage(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!normalized) return null;
  return normalized.startsWith("//") ? `https:${normalized}` : normalized;
}

/** «Схожі товари» under every product page (same brand first), streamed in a Suspense boundary. */
export async function ShopRelatedProductsSection({
  product,
  locale,
  viewerContext,
}: {
  product: ShopProduct;
  locale: SupportedLocale;
  viewerContext: ShopViewerPricingContext;
}) {
  // Brand-scoped fetch — ~95% of related-product picks come from the same
  // brand anyway. Heavy lift (DB query + mapDbToCatalog × N) runs here in
  // the Suspense subtree so it doesn't block the main PDP first byte.
  const brandPool = await getShopRelatedProductsByBrandServer(product.brand);
  const relatedPool =
    product.brand.trim().toLowerCase() === "wheelforce"
      ? brandPool.filter(
          (item) =>
            !(item.tags ?? []).includes(WHEELFORCE_FAMILY_CHILD_TAG) &&
            item.slug !== product.wheelForceFamily?.parentSlug
        )
      : brandPool;
  const isWheelForceBrand = product.brand.trim().toLowerCase() === "wheelforce";
  const wheelSetRecommendations = isWheelForceBrand
    ? findRelatedProducts(product, relatedPool.filter(isWheelForceWheelSet), 3)
    : [];
  const remainingRecommendationSlots = Math.max(0, 3 - wheelSetRecommendations.length);
  const otherRecommendations = remainingRecommendationSlots
    ? findRelatedProducts(
        product,
        isWheelForceBrand ? relatedPool.filter((item) => !isWheelForceWheelSet(item)) : relatedPool,
        remainingRecommendationSlots
      )
    : [];
  const relatedProducts = isWheelForceBrand
    ? [...wheelSetRecommendations, ...otherRecommendations]
    : otherRecommendations;
  if (!relatedProducts.length) return null;
  const isUa = locale === "ua";
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-light">{isUa ? "Схожі товари" : "Related products"}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {relatedProducts.map((item) => {
          const image = normalizeImage(item.image);
          const relatedPricing = resolveShopProductPricing(item, viewerContext);
          const relatedPrice = isWheelForceWheel(item)
            ? wheelForceSetMoney(relatedPricing.effectivePrice)
            : relatedPricing.effectivePrice;
          return (
            <Link
              key={item.slug}
              href={buildShopStorefrontProductPathForProduct(locale, item)}
              className="group overflow-hidden rounded-2xl border border-foreground/15 bg-foreground/5 transition hover:border-primary/35"
            >
              <div className="relative aspect-4/3 overflow-hidden bg-white border-b border-zinc-950/10 flex items-center justify-center p-4">
                {image ? (
                  <ShopProductImage
                    src={image}
                    alt={localizeShopProductTitle(locale, item)}
                    fill
                    sizes="(max-width: 1280px) 100vw, 30vw"
                    fallbackSrc="/images/placeholders/product-fallback.svg"
                    className="object-contain p-4 mix-blend-multiply transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                    <ShoppingBag className="h-12 w-12 opacity-30" />
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/70 dark:text-foreground/55">
                  {item.brand}
                </p>
                <h3 className="text-lg font-light leading-snug">
                  {localizeShopProductTitle(locale, item)}
                </h3>
                <p className="text-sm text-foreground/80 dark:text-foreground/65">
                  <ShopInlinePriceText
                    locale={locale}
                    price={relatedPrice}
                    requestLabel={isUa ? "Ціна за запитом" : "Price on request"}
                  />
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
