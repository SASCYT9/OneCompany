"use client";

import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { useResolvedShopPrice } from "@/components/shop/useResolvedShopPrice";
import type { ShopMoneySet } from "@/lib/shopCatalog";

type Locale = "ua" | "en";

type Variant = "compact" | "minimal" | "ultra-compact";

type ClassNames = {
  /** Outer wrapper. */
  root?: string;
  /** The primary (dealer / retail) price text. */
  price?: string;
  /** The strikethrough retail price (only rendered when discount applied). */
  retail?: string;
  /** The "−X%" badge. */
  badge?: string;
};

type Props = {
  locale: Locale;
  /** Canonical retail / B2C price. Required. */
  b2cPrice: ShopMoneySet;
  /** Optional explicit B2B override (per-product fixed B2B price). */
  b2bExplicit?: Partial<ShopMoneySet> | null;
  /** Optional retail / MSRP from product fields. Used when no B2B discount is in effect. */
  compareAt?: ShopMoneySet | null;
  /** Product brand — enables per-brand discount lookup. */
  brand?: string | null;
  /** Layout density preset. Drives default font-sizes / spacing. */
  variant?: Variant;
  /** Per-host theming overrides. */
  classNames?: ClassNames;
  /** Label rendered when no valid price is available. */
  requestLabel?: string;
};

function formatPrice(locale: Locale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const effectiveLocale = locale === "ua" ? "uk-UA" : "en-US";
  const formatted = new Intl.NumberFormat(effectiveLocale, {
    maximumFractionDigits: 0,
  }).format(amount);

  if (locale === "ua") {
    if (currency === "UAH") return `${formatted} грн`;
    return `${formatted} ${currency}`;
  }
  return `${currency} ${formatted}`;
}

function hasValid(value?: number | null) {
  return typeof value === "number" && value > 0;
}

/**
 * Cross-currency derivation: given a ShopMoneySet that may have only one
 * currency populated, fill the other two using live FX rates. Mirrors the
 * logic in `ShopPrimaryPriceBox` so the two views stay in sync.
 */
function deriveAcrossCurrencies(
  price: ShopMoneySet,
  rates: { EUR: number; USD: number; UAH: number } | null
) {
  let uah = price.uah || 0;
  let eur = price.eur || 0;
  let usd = price.usd || 0;

  if (hasValid(uah) && rates) {
    if (!hasValid(eur)) eur = (uah / rates.UAH) * rates.EUR;
    if (!hasValid(usd)) usd = (uah / rates.UAH) * rates.USD;
  } else if (hasValid(eur) && rates) {
    if (!hasValid(uah)) uah = (eur / rates.EUR) * rates.UAH;
    if (!hasValid(usd)) usd = (eur / rates.EUR) * rates.USD;
  } else if (hasValid(usd) && rates) {
    if (!hasValid(uah)) uah = (usd / rates.USD) * rates.UAH;
    if (!hasValid(eur)) eur = (usd / rates.USD) * rates.EUR;
  }

  return { uah, eur, usd };
}

const VARIANT_DEFAULTS: Record<
  Variant,
  { price: string; retail: string; badge: string; root: string }
> = {
  compact: {
    root: "flex flex-wrap items-baseline gap-2",
    price: "text-sm font-semibold tracking-wide tabular-nums",
    retail: "text-[11px] font-light line-through opacity-60",
    badge:
      "inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary",
  },
  minimal: {
    root: "flex items-baseline gap-1.5",
    price: "text-xs font-medium tracking-wide tabular-nums",
    retail: "text-[10px] font-light line-through opacity-55",
    badge:
      "inline-flex items-center rounded-sm bg-primary/15 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-primary",
  },
  "ultra-compact": {
    root: "flex items-baseline gap-1",
    price: "text-[11px] font-semibold tracking-wide tabular-nums",
    retail: "text-[9px] font-light line-through opacity-55",
    badge:
      "inline-flex items-center rounded-sm bg-primary/20 px-1 py-0 text-[8px] font-bold tracking-wider text-primary",
  },
};

/**
 * Compact, grid-friendly price display with B2B-discount awareness.
 *
 * Renders:
 *   - The effective (dealer) price as primary text.
 *   - A line-through retail price when a B2B discount or explicit override
 *     is active (and the retail differs from effective in the active
 *     currency).
 *   - A "−X%" badge for percent-based discounts (hidden for flat
 *     explicit-B2B overrides since "%" is meaningless there).
 *
 * Always renders the same DOM tree shape regardless of viewer state to
 * avoid SSR/CSR hydration warnings: when no discount is in effect, the
 * retail span and badge are simply not rendered (React tolerates absent
 * children, but the wrapper `<span>` is always present).
 */
export function ShopCardPriceTag({
  locale,
  b2cPrice,
  b2bExplicit,
  compareAt,
  brand,
  variant = "compact",
  classNames,
  requestLabel,
}: Props) {
  const { currency, rates } = useShopCurrency();
  const isUa = locale === "ua";
  const fallbackLabel = requestLabel ?? (isUa ? "Ціна за запитом" : "Price on Request");

  const resolved = useResolvedShopPrice({ b2cPrice, b2bExplicit, brand });

  const effectiveAcross = deriveAcrossCurrencies(resolved.effective, rates);
  const displayAmount =
    currency === "USD"
      ? effectiveAcross.usd
      : currency === "EUR"
        ? effectiveAcross.eur
        : effectiveAcross.uah;

  const defaults = VARIANT_DEFAULTS[variant];
  const rootClass = classNames?.root ?? defaults.root;
  const priceClass = classNames?.price ?? defaults.price;
  const retailClass = classNames?.retail ?? defaults.retail;
  const badgeClass = classNames?.badge ?? defaults.badge;

  // No valid price → render a "price on request" pill in the same wrapper
  // shape so layouts don't shift.
  if (!hasValid(displayAmount)) {
    return (
      <span className={rootClass}>
        <span className={priceClass}>{fallbackLabel}</span>
      </span>
    );
  }

  // Resolve retail to render strikethrough. Priority:
  //   1. `resolved.retail` (computed when a B2B discount/override is active)
  //   2. `compareAt` prop (product-level MSRP if no B2B discount)
  const retailSource = resolved.retail ?? compareAt ?? null;
  let retailDisplay: string | null = null;

  if (retailSource) {
    const retailAcross = deriveAcrossCurrencies(retailSource, rates);
    const retailAmount =
      currency === "USD"
        ? retailAcross.usd
        : currency === "EUR"
          ? retailAcross.eur
          : retailAcross.uah;
    // Only render strikethrough when the rounded retail amount in the
    // active currency is meaningfully larger than the displayed dealer
    // amount — avoids visible "$100 / $100" after rounding.
    if (hasValid(retailAmount) && Math.round(retailAmount) > Math.round(displayAmount)) {
      retailDisplay = formatPrice(locale, retailAmount, currency);
    }
  }

  // Badge: percentage-based discount path (hidden for explicit B2B overrides).
  const showBadge = resolved.discountPct > 0;

  return (
    <span className={rootClass}>
      <span className={priceClass}>{formatPrice(locale, displayAmount, currency)}</span>
      {retailDisplay ? <span className={retailClass}>{retailDisplay}</span> : null}
      {showBadge ? <span className={badgeClass}>B2B</span> : null}
    </span>
  );
}
