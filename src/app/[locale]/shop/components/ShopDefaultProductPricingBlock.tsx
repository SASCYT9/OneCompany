"use client";

import { useShopViewerContext } from "@/lib/useShopViewerContext";
import {
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { SupportedLocale } from "@/lib/seo";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { ShopB2BPricingBand } from "@/components/shop/ShopB2BPricingBand";

type Props = {
  product: ShopProduct;
  ssrViewerContext: ShopViewerPricingContext;
  locale: SupportedLocale;
  isUa: boolean;
};

export function ShopDefaultProductPricingBlock({ product, ssrViewerContext, locale, isUa }: Props) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const pricing = resolveShopProductPricing(product, viewerContext);
  return (
    <div className="rounded-2xl border border-foreground/12 bg-card shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:bg-black/40 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] p-5 space-y-4">
      <div className="flex flex-col">
        <ShopPrimaryPriceBox locale={locale} isUa={isUa} price={pricing.effectivePrice} />
      </div>

      <ShopB2BPricingBand pricing={pricing} locale={locale} />
    </div>
  );
}
