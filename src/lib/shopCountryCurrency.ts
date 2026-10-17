import { isUkraineCountry } from "@/lib/revozportShipping";
import { isEuropePricingCountry } from "@/lib/shopEuropePricing";
import type { ShopCurrencyCode } from "@/lib/shopCurrencyDefaults";

export function defaultCurrencyForShopCountry(country: string): ShopCurrencyCode {
  if (isUkraineCountry(country)) return "UAH";
  return isEuropePricingCountry(country) ? "EUR" : "USD";
}

/** Shoppers in Ukraine see and pay hryvnia only; EUR/USD cannot be chosen there. */
export function isShopCurrencyAllowedForCountry(country: string, currency: ShopCurrencyCode) {
  return currency === "UAH" || !isUkraineCountry(country);
}
