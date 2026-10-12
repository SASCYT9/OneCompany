import { managedAdminPriceChange } from "@/lib/shopAdminPriceConversion";
import type { ShopCurrencyCode } from "@/lib/shopCurrencyDefaults";
import {
  ATOMIC_EUR_SOURCE_BRANDS,
  isManualShopPriceBook,
  isShopSourcePriceBook,
  shopUahSaleRate,
  tryRepriceShopSourceMoney,
  type ShopPriceBookRates,
} from "@/lib/shopPriceBookCurrency";
import { isRevozportBrand } from "@/lib/revozportShipping";

/**
 * Plain-language model behind the product price editor.
 *
 * Every price band stores one *source* amount in one currency; the storefront
 * derives the other currencies from the price book on every render, so a stored
 * UAH next to an EUR source is only a snapshot. The editor therefore edits one
 * amount + currency per band and shows what the customer actually pays.
 */
export type ProductPriceBand = "price" | "compareAt" | "b2bPrice" | "b2bCompareAt";

export const PRODUCT_PRICE_BAND_FIELDS = {
  price: { source: "priceSourceCurrency", EUR: "priceEur", USD: "priceUsd", UAH: "priceUah" },
  compareAt: {
    source: "compareAtSourceCurrency",
    EUR: "compareAtEur",
    USD: "compareAtUsd",
    UAH: "compareAtUah",
  },
  b2bPrice: {
    source: "b2bPriceSourceCurrency",
    EUR: "priceEurB2b",
    USD: "priceUsdB2b",
    UAH: "priceUahB2b",
  },
  b2bCompareAt: {
    source: "b2bCompareAtSourceCurrency",
    EUR: "compareAtEurB2b",
    USD: "compareAtUsdB2b",
    UAH: "compareAtUahB2b",
  },
} as const;

export const PRODUCT_PRICE_CURRENCIES = ["EUR", "USD", "UAH"] as const;

export type PriceFormLike = Record<string, unknown>;
export type CustomerMoney = { eur: number; usd: number; uah: number };

function positive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/** The band's source currency and amount as the storefront resolves them. */
export function readPriceBand(form: PriceFormLike, band: ProductPriceBand) {
  const fields = PRODUCT_PRICE_BAND_FIELDS[band];
  const declared = String(form[fields.source] ?? "");
  const present = PRODUCT_PRICE_CURRENCIES.filter((currency) => positive(form[fields[currency]]));
  const currency: ShopCurrencyCode | null = (
    PRODUCT_PRICE_CURRENCIES as readonly string[]
  ).includes(declared)
    ? (declared as ShopCurrencyCode)
    : present.length === 1
      ? present[0]
      : present.includes("EUR")
        ? "EUR"
        : (present[0] ?? null);
  const amount = currency ? positive(form[fields[currency]]) : 0;
  return { currency, amount, isSet: amount > 0 };
}

/** What a retail customer is charged in each currency at today's price book. */
export function customerMoney(
  form: PriceFormLike,
  band: ProductPriceBand,
  rates: Record<string, number>
): CustomerMoney | null {
  const { currency, amount } = readPriceBand(form, band);
  if (!currency || amount <= 0) return null;
  if (isShopSourcePriceBook(rates)) {
    const priced = tryRepriceShopSourceMoney(
      {
        eur: currency === "EUR" ? amount : 0,
        usd: currency === "USD" ? amount : 0,
        uah: currency === "UAH" ? amount : 0,
        sourceCurrency: currency,
      },
      rates as ShopPriceBookRates
    );
    if (priced) return { eur: priced.eur, usd: priced.usd, uah: priced.uah };
  }
  const fields = PRODUCT_PRICE_BAND_FIELDS[band];
  return {
    eur: positive(form[fields.EUR]),
    usd: positive(form[fields.USD]),
    uah: positive(form[fields.UAH]),
  };
}

/** Form patch that sets a band to `amount` in `currency` (or clears it). */
export function priceBandPatch(
  band: ProductPriceBand,
  amount: number | null,
  currency: ShopCurrencyCode,
  rates: Record<string, number>
): Record<string, string> {
  const fields = PRODUCT_PRICE_BAND_FIELDS[band];
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return { [fields.source]: "", [fields.EUR]: "", [fields.USD]: "", [fields.UAH]: "" };
  }
  const managed = managedAdminPriceChange(amount, currency, rates);
  if (managed) {
    return {
      [fields.source]: managed.sourceCurrency,
      [fields.EUR]: managed.eur,
      [fields.USD]: managed.usd,
      [fields.UAH]: managed.uah,
    };
  }
  return {
    [fields.source]: currency,
    [fields.EUR]: currency === "EUR" ? String(amount) : "",
    [fields.USD]: currency === "USD" ? String(amount) : "",
    [fields.UAH]: currency === "UAH" ? String(amount) : "",
  };
}

/**
 * Switching the currency keeps today's customer price and re-anchors it: an EUR
 * price of €100 switched to UAH becomes a fixed 5 150 ₴ instead of reusing a
 * stale UAH snapshot.
 */
export function switchPriceBandCurrency(
  form: PriceFormLike,
  band: ProductPriceBand,
  currency: ShopCurrencyCode,
  rates: Record<string, number>
) {
  const money = customerMoney(form, band, rates);
  // The API rejects a source currency without an amount; an empty band has nothing to move.
  if (!money) return {};
  const amount = money[currency.toLowerCase() as keyof CustomerMoney];
  const rounded = currency === "UAH" ? Math.round(amount) : Math.round(amount * 100) / 100;
  return priceBandPatch(band, rounded, currency, rates);
}

/** Copies every price band (and the Europe price) so a single variant never diverges. */
export function priceFieldsOf(form: PriceFormLike): Record<string, string> {
  const result: Record<string, string> = {
    priceEurEurope: String(form.priceEurEurope ?? ""),
  };
  for (const fields of Object.values(PRODUCT_PRICE_BAND_FIELDS)) {
    for (const key of [fields.source, fields.EUR, fields.USD, fields.UAH]) {
      result[key] = String(form[key] ?? "");
    }
  }
  return result;
}

/** True when a product's own price differs from its only variant's price. */
export function variantPriceDiffers(
  product: PriceFormLike,
  variant: PriceFormLike,
  rates: Record<string, number>
) {
  const left = customerMoney(product, "price", rates);
  const right = customerMoney(variant, "price", rates);
  if (!left || !right) return false;
  return Math.abs(left.uah - right.uah) >= 1;
}

export function priceFormulaText(currency: ShopCurrencyCode, rates: Record<string, number>) {
  if (currency === "UAH") return "Фіксована сума в гривнях — не змінюється разом із курсом.";
  if (!isShopSourcePriceBook(rates)) {
    return `Гривня та інші валюти перераховуються за курсом магазину (1 € = ${rates.UAH} грн).`;
  }
  const rate = shopUahSaleRate(currency, rates as ShopPriceBookRates);
  const symbol = currency === "EUR" ? "€" : "$";
  const reserve = Number(rates._uahReserve ?? 0);
  const basis =
    isManualShopPriceBook(rates) || !(reserve > 0)
      ? "курс магазину з налаштувань"
      : `курс НБУ + ${reserve} грн запасу`;
  return `Ціна в гривнях = ${symbol} × ${rate.toFixed(2)} грн (${basis}).`;
}

export function isAtomicManagedBrand(brand: string | null | undefined) {
  const key = (brand ?? "").trim().toLowerCase();
  return (ATOMIC_EUR_SOURCE_BRANDS as readonly string[]).includes(key);
}

export function isRevozportManagedBrand(brand: string | null | undefined) {
  return isRevozportBrand(brand);
}

/** Wholesale discount a B2B customer gets when the product has no explicit B2B price. */
export function b2bDiscountForBrand(
  brand: string | null | undefined,
  context: { defaultB2bDiscountPercent: number | null; brandB2bDiscounts: Record<string, number> }
): { percent: number; source: "brand" | "default" } | null {
  const key = (brand ?? "").trim().toLowerCase();
  const brandPercent = key ? context.brandB2bDiscounts[key] : undefined;
  if (brandPercent != null && Number.isFinite(brandPercent)) {
    return { percent: brandPercent, source: "brand" };
  }
  const fallback = context.defaultB2bDiscountPercent;
  return fallback != null && fallback > 0 ? { percent: fallback, source: "default" } : null;
}

export function discountPercent(price: number, compareAt: number) {
  if (!(price > 0) || !(compareAt > price)) return null;
  return Math.round((1 - price / compareAt) * 100);
}
