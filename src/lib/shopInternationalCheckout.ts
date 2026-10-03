import { isUkraineCountry } from "@/lib/revozportShipping";
import type { ShopCurrencyCode } from "@/lib/shopMoneyFormat";

export const INTERNATIONAL_DELIVERY_CONSENT_VERSION = "international-delivery-24h-v1";

export function isInternationalDelivery(country: string) {
  return Boolean(country.trim()) && !isUkraineCountry(country);
}

/** Saved agreements bind the currency and exact saved order amount. Client-safe. */
export function internationalDeliveryAgreementMatches(
  pricingSnapshot: unknown,
  currency: string,
  total: number | { toString(): string }
) {
  const snapshot = pricingSnapshot && typeof pricingSnapshot === "object" && !Array.isArray(pricingSnapshot)
    ? pricingSnapshot as Record<string, unknown> : {};
  const value = snapshot.internationalDelivery;
  const agreement = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const amount = Number(total.toString());
  return agreement.status === "agreed" && agreement.currency === currency &&
    typeof agreement.total === "number" && Number.isFinite(amount) && amount > 0 &&
    agreement.total === amount;
}

export function getAgreedInternationalShippingSource(pricingSnapshot: unknown) {
  const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const agreement = object(object(pricingSnapshot).internationalDelivery);
  const shipping = object(agreement.shippingQuote);
  if (agreement.status !== "agreed" || typeof shipping.amount !== "number" ||
    !Number.isFinite(shipping.amount) || shipping.amount < 0 ||
    typeof shipping.currency !== "string" || !["UAH", "EUR", "USD"].includes(shipping.currency)) return null;
  return { amount: shipping.amount, currency: shipping.currency as ShopCurrencyCode };
}

export function validateInternationalCheckout(country: string, paymentMethod: string, consent: unknown) {
  if (!isInternationalDelivery(country)) return paymentMethod === "MANAGER_QUOTE" ? "MANAGER_QUOTE_REQUIRES_INTERNATIONAL_DELIVERY" : null;
  if (consent !== true) return "INTERNATIONAL_DELIVERY_CONSENT_REQUIRED";
  if (paymentMethod !== "MANAGER_QUOTE") return "INTERNATIONAL_DELIVERY_QUOTE_REQUIRED";
  return null;
}
