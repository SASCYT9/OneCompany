"use client";

import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import {
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { SupportedLocale } from "@/lib/seo";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { ShopInlinePriceText } from "@/components/shop/ShopInlinePriceText";
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
  const { rates } = useShopCurrency();

  const computeCrossPrices = (priceObj: { eur: number; usd: number; uah: number }) => {
    let computedUah = priceObj.uah || 0;
    let computedEur = priceObj.eur || 0;
    let computedUsd = priceObj.usd || 0;

    const hasValid = (v?: number) => typeof v === "number" && v > 0;

    if (hasValid(priceObj.uah) && rates) {
      if (!hasValid(computedEur)) computedEur = (priceObj.uah / rates.UAH) * rates.EUR;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.uah / rates.UAH) * rates.USD;
    } else if (hasValid(priceObj.eur) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.eur / rates.EUR) * rates.UAH;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.eur / rates.EUR) * rates.USD;
    } else if (hasValid(priceObj.usd) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.usd / rates.USD) * rates.UAH;
      if (!hasValid(computedEur)) computedEur = (priceObj.usd / rates.USD) * rates.EUR;
    }

    return { uah: computedUah, eur: computedEur, usd: computedUsd };
  };

  return (
    <div className="rounded-2xl border border-foreground/12 bg-card shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:bg-black/40 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] p-5 space-y-4">
      <div className="flex flex-col">
        <ShopPrimaryPriceBox locale={locale} isUa={isUa} price={pricing.effectivePrice} />
        {pricing.effectiveCompareAt ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40">
              {isUa ? "Стара ціна" : "Was"}
            </span>
            <ShopInlinePriceText
              locale={locale}
              price={computeCrossPrices(pricing.effectiveCompareAt)}
              className="text-sm text-red-400/80 line-through"
              requestLabel={isUa ? "Ціна за запитом" : "Price on request"}
            />
          </div>
        ) : null}
      </div>

      <ShopB2BPricingBand pricing={pricing} locale={locale} />
    </div>
  );
}
