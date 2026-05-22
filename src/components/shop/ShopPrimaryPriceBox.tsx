"use client";

import { useMemo } from "react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import type { ShopMoneySet } from "@/lib/shopCatalog";

type Props = {
  locale: "ua" | "en";
  isUa: boolean;
  /** SSR-resolved price (legacy callers). When `b2cPrice` is supplied,
   *  this component picks the right band client-side based on session. */
  price: ShopMoneySet;
  /** Optional: pass raw B2C/B2B bands so a logged-in B2B customer gets
   *  per-brand discount applied client-side without a server re-render. */
  b2cPrice?: ShopMoneySet | null;
  b2bExplicit?: Partial<ShopMoneySet> | null;
  /** Product brand for per-brand discount lookup. */
  brand?: string | null;
};

function formatPrice(locale: "ua" | "en", amount: number, currency: "EUR" | "USD" | "UAH") {
  const effectiveLocale = locale === "ua" ? "uk-UA" : "en-US";
  const formattedAmount = new Intl.NumberFormat(effectiveLocale, {
    maximumFractionDigits: 0,
  }).format(amount);

  if (locale === "ua") {
    if (currency === "UAH") return `${formattedAmount} грн`;
    return `${formattedAmount} ${currency}`;
  }

  return `${currency} ${formattedAmount}`;
}

export function ShopPrimaryPriceBox({ locale, isUa, price, b2cPrice, b2bExplicit, brand }: Props) {
  const { currency, rates } = useShopCurrency();
  const viewer = useShopViewerContext();

  const hasValid = (value?: number | null) => typeof value === "number" && value > 0;

  // Client-side discount resolution: if caller passed raw bands, recompute
  // the effective price using the live session + per-brand discount maps.
  // Otherwise fall back to the SSR-rendered `price` prop.
  //
  // Returns BOTH the effective price AND metadata (discount %, was the
  // original price different) so the UI can render the strikethrough RRP
  // + savings badge alongside the dealer price.
  const resolved = useMemo<{
    effective: ShopMoneySet;
    retail: ShopMoneySet | null;
    discountPct: number;
  }>(() => {
    if (!b2cPrice || viewer.customerGroup !== "B2B_APPROVED") {
      return { effective: price, retail: null, discountPct: 0 };
    }
    // Explicit B2B price (from product fields) wins outright. The
    // strikethrough is the b2c price; no percentage to display.
    if (b2bExplicit && (b2bExplicit.eur || b2bExplicit.usd || b2bExplicit.uah)) {
      const eff = {
        eur: Number(b2bExplicit.eur ?? 0) || b2cPrice.eur || 0,
        usd: Number(b2bExplicit.usd ?? 0) || b2cPrice.usd || 0,
        uah: Number(b2bExplicit.uah ?? 0) || b2cPrice.uah || 0,
      };
      return { effective: eff, retail: b2cPrice, discountPct: 0 };
    }
    // Resolve percentage via 4-tier (customer-brand → system-brand →
    // customer-global → 0). Mirrors resolveEffectiveDiscountPercent in
    // shopPricingAudience.ts.
    const key = String(brand ?? "")
      .trim()
      .toLowerCase();
    let pct = 0;
    if (key) {
      const c = viewer.customerBrandDiscountMap?.get(key);
      if (c != null) pct = c;
      else {
        const s = viewer.systemBrandDiscountMap?.get(key);
        if (s != null) pct = s;
      }
    }
    if (pct === 0) pct = Number(viewer.customerB2BDiscountPercent ?? 0);
    if (pct <= 0) return { effective: b2cPrice, retail: null, discountPct: 0 };
    const mul = 1 - pct / 100;
    const eff = {
      eur: b2cPrice.eur > 0 ? Math.round(b2cPrice.eur * mul * 100) / 100 : 0,
      usd: b2cPrice.usd > 0 ? Math.round(b2cPrice.usd * mul * 100) / 100 : 0,
      uah: b2cPrice.uah > 0 ? Math.round(b2cPrice.uah * mul) : 0,
    };
    return { effective: eff, retail: b2cPrice, discountPct: pct };
  }, [
    price,
    b2cPrice,
    b2bExplicit,
    brand,
    viewer.customerGroup,
    viewer.customerB2BDiscountPercent,
    viewer.systemBrandDiscountMap,
    viewer.customerBrandDiscountMap,
  ]);
  const effectivePrice = resolved.effective;
  const retailPrice = resolved.retail;
  const discountPct = resolved.discountPct;

  const amountEur = effectivePrice.eur || 0;
  const amountUah = effectivePrice.uah || 0;
  const amountUsd = effectivePrice.usd || 0;

  let computedUah = amountUah;
  let computedEur = amountEur;
  let computedUsd = amountUsd;

  if (hasValid(amountUah) && rates) {
    if (!hasValid(computedEur)) computedEur = (amountUah / rates.UAH) * rates.EUR;
    if (!hasValid(computedUsd)) computedUsd = (amountUah / rates.UAH) * rates.USD;
  } else if (hasValid(amountEur) && rates) {
    if (!hasValid(computedUah)) computedUah = (amountEur / rates.EUR) * rates.UAH;
    if (!hasValid(computedUsd)) computedUsd = (amountEur / rates.EUR) * rates.USD;
  } else if (hasValid(amountUsd) && rates) {
    if (!hasValid(computedUah)) computedUah = (amountUsd / rates.USD) * rates.UAH;
    if (!hasValid(computedEur)) computedEur = (amountUsd / rates.USD) * rates.EUR;
  }

  const displayAmount =
    currency === "USD" ? computedUsd : currency === "EUR" ? computedEur : computedUah;

  if (!hasValid(displayAmount)) {
    return (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/55 dark:text-foreground/40">
          {isUa ? "Ціна" : "Pricing"}
        </p>
        <p className="mt-2 text-2xl font-light text-foreground/85 dark:text-foreground/70">
          {isUa ? "Ціна за запитом" : "Price on Request"}
        </p>
      </>
    );
  }

  const conversionParts: string[] = [];
  if (currency !== "USD" && hasValid(computedUsd)) {
    conversionParts.push(formatPrice(locale, computedUsd, "USD"));
  }
  if (currency !== "EUR" && hasValid(computedEur)) {
    conversionParts.push(formatPrice(locale, computedEur, "EUR"));
  }
  if (currency !== "UAH" && hasValid(computedUah)) {
    conversionParts.push(formatPrice(locale, computedUah, "UAH"));
  }

  // Retail / RRP strikethrough: only when a discount was actually applied
  // AND the retail amount in the active currency is meaningfully bigger
  // than the dealer amount (avoid showing "$100 / $100" after rounding).
  const retailDisplay = (() => {
    if (!retailPrice) return null;
    const rUsd = retailPrice.usd || 0;
    const rEur = retailPrice.eur || 0;
    const rUah = retailPrice.uah || 0;
    // Mirror the same cross-currency derivation logic used for dealer price.
    let cUah = rUah;
    let cEur = rEur;
    let cUsd = rUsd;
    if (hasValid(rUah) && rates) {
      if (!hasValid(cEur)) cEur = (rUah / rates.UAH) * rates.EUR;
      if (!hasValid(cUsd)) cUsd = (rUah / rates.UAH) * rates.USD;
    } else if (hasValid(rEur) && rates) {
      if (!hasValid(cUah)) cUah = (rEur / rates.EUR) * rates.UAH;
      if (!hasValid(cUsd)) cUsd = (rEur / rates.EUR) * rates.USD;
    } else if (hasValid(rUsd) && rates) {
      if (!hasValid(cUah)) cUah = (rUsd / rates.USD) * rates.UAH;
      if (!hasValid(cEur)) cEur = (rUsd / rates.USD) * rates.EUR;
    }
    const amount = currency === "USD" ? cUsd : currency === "EUR" ? cEur : cUah;
    if (!hasValid(amount)) return null;
    // Hide if the rounded retail equals the rounded dealer (no visible diff).
    if (Math.round(amount) <= Math.round(displayAmount)) return null;
    return formatPrice(locale, amount, currency);
  })();

  const showDiscountBadge = discountPct > 0 || (retailDisplay && discountPct === 0);

  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground/55 dark:text-foreground/40">
        {retailDisplay ? (isUa ? "Ваша ціна" : "Your price") : isUa ? "Ціна" : "Pricing"}
      </p>
      {retailDisplay ? (
        <div className="mt-1.5 flex items-baseline gap-3">
          <p className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            {formatPrice(locale, displayAmount, currency)}
          </p>
          <p className="text-base font-light text-foreground/50 dark:text-foreground/35 line-through">
            {retailDisplay}
          </p>
          {showDiscountBadge ? (
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-primary">
              −{discountPct > 0 ? `${discountPct}%` : isUa ? "B2B" : "B2B"}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          {formatPrice(locale, displayAmount, currency)}
        </p>
      )}
      {conversionParts.length > 0 ? (
        <p className="mt-1 text-[13px] font-light tracking-wide text-foreground/65 dark:text-foreground/55">
          {conversionParts.join(" · ")}
        </p>
      ) : null}
      {retailDisplay ? (
        <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-foreground/55 dark:text-foreground/40">
          {isUa ? "РРЦ" : "MSRP"}: <span className="line-through">{retailDisplay}</span>
        </p>
      ) : null}
    </>
  );
}
