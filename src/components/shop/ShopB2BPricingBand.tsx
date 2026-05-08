"use client";

import type { SupportedLocale } from "@/lib/seo";
import type { ShopResolvedPricing } from "@/lib/shopPricingAudience";
import { ShopInlinePriceText } from "@/components/shop/ShopInlinePriceText";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";

type Props = {
  pricing: ShopResolvedPricing;
  locale: SupportedLocale;
  /** Optional className override for outer container. */
  className?: string;
};

/**
 * Single source of truth for the "B2B Pricing" disclosure band on product detail pages.
 *
 * Behaviors:
 * - Renders nothing when `pricing.b2bVisible` is false (i.e. plain B2C / no B2B price).
 * - Shows the resolved B2B price prominently.
 * - Shows the strikethrough B2C reference when audience === 'b2b' so the customer sees the
 *   original price next to their discounted price.
 * - Shows the discount percent badge (explicit B2B-discount path or base B2B band).
 * - Shows "pending verification" hint when account is not yet verified (`requestQuote`).
 *
 * Use this component in every brand-specific product detail layout to keep the B2B
 * presentation consistent across Akrapovic, Brabus, Burger, iPE, Racechip, etc.
 */
export function ShopB2BPricingBand({ pricing, locale, className }: Props) {
  const { rates } = useShopCurrency();
  if (!pricing.b2bVisible) return null;
  const isUa = locale === "ua";
  const b2bPrice = pricing.bands.b2b?.price ?? null;
  const b2cPrice = pricing.bands.b2c.price;
  const showStrikethroughB2C =
    pricing.audience === "b2b" && b2bPrice !== null && hasAnyAmount(b2cPrice);

  const explicitDiscount =
    pricing.audience === "b2b" && pricing.source === "b2b-discount" ? pricing.discountPercent : null;
  const baseB2BDiscount =
    pricing.bands.b2b?.source === "b2b-discount" ? pricing.bands.b2b.discountPercent : null;

  return (
    <div
      className={
        className ??
        "rounded-xl bg-cyan-950/30 border border-cyan-500/20 p-4 space-y-3"
      }
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] text-cyan-300">
          ✓
        </span>
        <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">
          {isUa ? "B2B Ціноутворення" : "B2B Pricing"}
        </p>
      </div>

      {b2bPrice ? (
        <div className="pl-7">
          <p className="text-2xl font-light text-white">
            <ShopInlinePriceText
              locale={locale}
              price={b2bPrice}
              requestLabel={isUa ? "Ціна за запитом" : "Price on request"}
            />
          </p>
          {showStrikethroughB2C ? (
            <p className="mt-1 text-xs text-white/40">
              <span className="line-through mr-2">
                <CrossPriceLine locale={locale} price={b2cPrice} rates={rates} />
              </span>
              <span className="text-cyan-100/60">
                {isUa ? "оригінал" : "original"}
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-cyan-100/50">
            <CrossPriceLine locale={locale} price={b2bPrice} rates={rates} skipPrimary />
          </p>
        </div>
      ) : null}

      {explicitDiscount != null ? (
        <div className="pl-7">
          <span className="inline-block px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] uppercase text-emerald-300 tracking-wider">
            {isUa
              ? `Знижка -${explicitDiscount}%`
              : `Discount -${explicitDiscount}%`}
          </span>
        </div>
      ) : baseB2BDiscount != null ? (
        <div className="pl-7">
          <span className="inline-block px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] uppercase text-cyan-300 tracking-wider">
            {isUa
              ? `Базова B2B знижка -${baseB2BDiscount}%`
              : `Base B2B discount -${baseB2BDiscount}%`}
          </span>
        </div>
      ) : null}

      {pricing.requestQuote ? (
        <p className="pl-7 text-[11px] text-cyan-200/50 leading-relaxed uppercase tracking-[0.1em]">
          {isUa ? "Очікує верифікації акаунта" : "Pending account verification"}
        </p>
      ) : null}
    </div>
  );
}

function hasAnyAmount(price: { eur: number; usd: number; uah: number } | null) {
  if (!price) return false;
  return price.eur > 0 || price.usd > 0 || price.uah > 0;
}

function CrossPriceLine({
  locale,
  price,
  rates,
  skipPrimary,
}: {
  locale: SupportedLocale;
  price: { eur: number; usd: number; uah: number };
  rates: { EUR: number; USD: number; UAH: number } | null;
  skipPrimary?: boolean;
}) {
  // Show all three currencies as a compact reference; useful as both
  // strikethrough-original and as B2B-price secondary line.
  const eur = price.eur || 0;
  const usd = price.usd || (rates && eur > 0 ? eur * rates.USD : 0);
  const uah = price.uah || (rates && eur > 0 ? eur * rates.UAH : 0);
  const parts: string[] = [];
  if (!skipPrimary && eur > 0) parts.push(formatShopMoney(locale, eur, "EUR"));
  if (usd > 0) parts.push(formatShopMoney(locale, usd, "USD" as ShopCurrencyCode));
  if (uah > 0) parts.push(formatShopMoney(locale, uah, "UAH" as ShopCurrencyCode));
  return <>{parts.join(" / ")}</>;
}
