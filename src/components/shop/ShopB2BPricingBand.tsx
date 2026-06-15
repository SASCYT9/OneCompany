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
  variant?: "bronze" | "cyan";
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
export function ShopB2BPricingBand({ pricing, locale, className, variant }: Props) {
  const { rates } = useShopCurrency();
  if (!pricing.b2bVisible) return null;
  const isUa = locale === "ua";
  const b2bPrice = pricing.bands.b2b?.price ?? null;
  const b2cPrice = pricing.bands.b2c.price;

  const v = variant ?? "cyan";
  const isBronze = v === "bronze";

  const containerClass =
    className ??
    (isBronze
      ? "rounded-none bg-black/40 backdrop-blur-md border border-[#c29d59]/25 p-4 space-y-3 shadow-lg"
      : "rounded-xl bg-cyan-950/30 border border-cyan-500/20 p-4 space-y-3");

  const checkCircleClass = isBronze
    ? "flex h-5 w-5 items-center justify-center rounded-full bg-[#c29d59]/20 text-[10px] text-[#f1d8a5]"
    : "flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] text-cyan-300";

  const titleClass = isBronze
    ? "text-xs uppercase tracking-[0.14em] text-[#f1d8a5]"
    : "text-xs uppercase tracking-[0.14em] text-cyan-200";

  const subPriceClass = isBronze
    ? "mt-1 text-[11px] text-[#f1d8a5]/50"
    : "mt-1 text-[11px] text-cyan-100/50";

  const discountBadgeClass = isBronze
    ? "inline-block px-2 py-1 bg-[#c29d59]/10 border border-[#c29d59]/20 rounded text-[10px] uppercase text-[#f1d8a5] tracking-wider"
    : "inline-block px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] uppercase text-cyan-300 tracking-wider";

  const explicitDiscountBadgeClass = isBronze
    ? "inline-block px-2 py-1 bg-[#c29d59]/15 border border-[#c29d59]/30 rounded text-[10px] uppercase text-[#f1d8a5] tracking-wider"
    : "inline-block px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] uppercase text-emerald-300 tracking-wider";

  const originalPriceLabelClass = isBronze
    ? "text-xs text-[#f1d8a5]/60"
    : "text-xs text-cyan-100/60";

  const originalPriceTextClass = isBronze
    ? "text-xs text-[#f1d8a5]/70"
    : "text-xs text-cyan-200/70";

  const pendingTextClass = isBronze
    ? "pl-7 text-[11px] text-[#f1d8a5]/50 leading-relaxed uppercase tracking-widest"
    : "pl-7 text-[11px] text-cyan-200/50 leading-relaxed uppercase tracking-widest";

  const showStrikethroughB2C = b2bPrice !== null && hasAnyAmount(b2cPrice);

  const explicitDiscount =
    pricing.audience === "b2b" && pricing.source === "b2b-discount"
      ? pricing.discountPercent
      : null;
  const baseB2BDiscount =
    pricing.bands.b2b?.source === "b2b-discount" ? pricing.bands.b2b.discountPercent : null;

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2">
        <span className={checkCircleClass}>✓</span>
        <p className={titleClass}>
          {pricing.audience === "b2b"
            ? isUa
              ? "B2B Ціни активовані"
              : "B2B Pricing Active"
            : isUa
              ? "B2B Ціноутворення"
              : "B2B Pricing"}
        </p>
      </div>

      {/* If logged in as B2B, show original B2C price crossed out */}
      {pricing.audience === "b2b" && b2cPrice && hasAnyAmount(b2cPrice) ? (
        <div className="pl-7">
          <p className={originalPriceTextClass}>
            {isUa ? "Оригінальна ціна (B2C):" : "Original price (B2C):"}{" "}
            <span
              className="line-through text-white/40 font-medium ml-1"
              suppressHydrationWarning={true}
            >
              <CrossPriceLine locale={locale} price={b2cPrice} rates={rates} />
            </span>
          </p>
        </div>
      ) : null}

      {/* If not logged in as B2B, show the prospective B2B price */}
      {b2bPrice && pricing.audience !== "b2b" ? (
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
              <span className="line-through mr-2" suppressHydrationWarning={true}>
                <CrossPriceLine locale={locale} price={b2cPrice} rates={rates} />
              </span>
              <span className={originalPriceLabelClass}>{isUa ? "оригінал" : "original"}</span>
            </p>
          ) : null}
          <p className={subPriceClass} suppressHydrationWarning={true}>
            <CrossPriceLine locale={locale} price={b2bPrice} rates={rates} />
          </p>
        </div>
      ) : null}

      {explicitDiscount != null ? (
        <div className="pl-7">
          <span className={explicitDiscountBadgeClass}>{isUa ? "B2B Знижка" : "B2B Discount"}</span>
        </div>
      ) : baseB2BDiscount != null ? (
        <div className="pl-7">
          <span className={discountBadgeClass}>
            {isUa ? "Базова B2B знижка" : "Base B2B discount"}
          </span>
        </div>
      ) : null}

      {pricing.requestQuote ? (
        <p className={pendingTextClass}>
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
  activeCurrency,
  skipActive,
}: {
  locale: SupportedLocale;
  price: { eur: number; usd: number; uah: number };
  rates: { EUR: number; USD: number; UAH: number } | null;
  activeCurrency?: string;
  skipActive?: boolean;
}) {
  // Show all three currencies as a compact reference; useful as both
  // strikethrough-original and as B2B-price secondary line.
  const eur = price.eur || 0;
  const usd = price.usd || (rates && eur > 0 ? eur * rates.USD : 0);
  const uah = price.uah || (rates && eur > 0 ? eur * rates.UAH : 0);
  const parts: string[] = [];

  if (eur > 0 && (!skipActive || activeCurrency !== "EUR")) {
    parts.push(formatShopMoney(locale, eur, "EUR"));
  }
  if (usd > 0 && (!skipActive || activeCurrency !== "USD")) {
    parts.push(formatShopMoney(locale, usd, "USD" as ShopCurrencyCode));
  }
  if (uah > 0 && (!skipActive || activeCurrency !== "UAH")) {
    parts.push(formatShopMoney(locale, uah, "UAH" as ShopCurrencyCode));
  }
  return <>{parts.join(" / ")}</>;
}
