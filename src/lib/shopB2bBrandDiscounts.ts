/**
 * The one place that decides which B2B discount a partner gets on a brand.
 * Storefront pricing, the admin price check and admin-created orders all call
 * it, so a partner, a manager and an invoice always agree.
 *
 * Priority (highest → lowest), B2B-approved partners only for tiers 1–3:
 *   1. ShopCustomerBrandDiscount        — this partner, this brand
 *   2. ShopBrandB2bDiscount             — this brand, every partner
 *   3. ShopCustomer.b2bDiscountPercent  — this partner, every other brand
 *   4. ShopSettings.defaultB2bDiscountPercent
 *
 * A brand rule of 0 % is a real rule ("no discount on this brand") and stops
 * the fall-through. Brands match case-insensitively on the storefront brand
 * (`resolveShopProductBrand`), e.g. Urban products resolve to "Urban Automotive".
 */

export type ShopB2bDiscountSource =
  | "customer-brand"
  | "system-brand"
  | "customer-global"
  | "default"
  | "none";

export type ShopB2bDiscountResolution = {
  percent: number;
  source: ShopB2bDiscountSource;
};

export type ShopB2bDiscountInput = {
  customerGroup: string | null | undefined;
  brand?: string | null;
  customerBrandDiscountMap?: ReadonlyMap<string, number>;
  systemBrandDiscountMap?: ReadonlyMap<string, number>;
  customerB2BDiscountPercent?: number | null;
  defaultB2BDiscountPercent?: number | null;
};

export function normalizeShopBrandKey(brand: string | null | undefined) {
  return String(brand ?? "")
    .trim()
    .toLowerCase();
}

export function clampShopDiscountPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 100);
}

export function buildShopBrandDiscountMap(
  rows: ReadonlyArray<{ brand: string; discountPct: unknown }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeShopBrandKey(row.brand);
    const value = Number(row.discountPct);
    if (key && Number.isFinite(value) && value >= 0) map.set(key, value);
  }
  return map;
}

export function resolveShopB2bDiscount(input: ShopB2bDiscountInput): ShopB2bDiscountResolution {
  const approved = input.customerGroup === "B2B_APPROVED";

  if (approved) {
    const key = normalizeShopBrandKey(input.brand);
    if (key) {
      const customerBrand = input.customerBrandDiscountMap?.get(key);
      if (customerBrand != null) {
        return { percent: clampShopDiscountPercent(customerBrand), source: "customer-brand" };
      }
      const systemBrand = input.systemBrandDiscountMap?.get(key);
      if (systemBrand != null) {
        return { percent: clampShopDiscountPercent(systemBrand), source: "system-brand" };
      }
    }

    const customerGlobal = clampShopDiscountPercent(input.customerB2BDiscountPercent);
    if (customerGlobal > 0) return { percent: customerGlobal, source: "customer-global" };
  }

  // Guests and retail customers still resolve the default so a public
  // dual-price band can show it; checkout charges them the retail price.
  const fallback = clampShopDiscountPercent(input.defaultB2BDiscountPercent);
  return fallback > 0 ? { percent: fallback, source: "default" } : { percent: 0, source: "none" };
}

/** A partner's terms as plain JSON (admin API → order and proforma screens). */
export type ShopB2bPricingTerms = {
  group: string;
  b2bDiscountPercent: number | null;
  defaultB2bDiscountPercent: number | null;
  systemBrandDiscounts: ReadonlyArray<{ brand: string; discountPct: number }>;
  customerBrandDiscounts: ReadonlyArray<{ brand: string; discountPct: number }>;
};

export function createShopB2bTermsResolver(terms: ShopB2bPricingTerms | null | undefined) {
  if (!terms) return () => ({ percent: 0, source: "none" }) as ShopB2bDiscountResolution;
  const systemBrandDiscountMap = buildShopBrandDiscountMap(terms.systemBrandDiscounts);
  const customerBrandDiscountMap = buildShopBrandDiscountMap(terms.customerBrandDiscounts);
  return (brand: string | null | undefined) =>
    resolveShopB2bDiscount({
      customerGroup: terms.group,
      brand,
      customerBrandDiscountMap,
      systemBrandDiscountMap,
      customerB2BDiscountPercent: terms.b2bDiscountPercent,
      // Admin orders price for one known partner; the public default only
      // matters to approved partners there, never to retail customers.
      defaultB2BDiscountPercent:
        terms.group === "B2B_APPROVED" ? terms.defaultB2bDiscountPercent : null,
    });
}

export const SHOP_B2B_DISCOUNT_SOURCE_LABELS: Readonly<Record<ShopB2bDiscountSource, string>> = {
  "customer-brand": "Знижка партнера на бренд",
  "system-brand": "Знижка бренду для всіх партнерів",
  "customer-global": "Знижка партнера на інші бренди",
  default: "Загальна B2B-знижка",
  none: "Без знижки",
};
