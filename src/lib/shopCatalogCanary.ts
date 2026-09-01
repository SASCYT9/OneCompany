export const SHOP_CATALOG_CANARY_COOKIE = "shop_catalog_v2_rollout";
export const SHOP_CATALOG_CANARY_SELECTED_COOKIE = "shop_catalog_v2_selected";
export const SHOP_CATALOG_CANARY_REQUEST_HEADER = "x-shop-catalog-v2-canary";

export type ShopCatalogCanaryConfig = {
  percentage: number;
  locales: ReadonlySet<string>;
  brands: ReadonlySet<string>;
  categories: ReadonlySet<string>;
};

function normalizedSet(value: string | null | undefined) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function parseShopCatalogCanaryConfig(env: Record<string, string | undefined>) {
  const rawPercentage = Number(env.SHOP_CATALOG_V2_CANARY_PERCENTAGE ?? "0");
  return Object.freeze({
    percentage:
      Number.isFinite(rawPercentage) && Number.isInteger(rawPercentage)
        ? Math.max(0, Math.min(100, rawPercentage))
        : 0,
    locales: normalizedSet(env.SHOP_CATALOG_V2_CANARY_LOCALES),
    brands: normalizedSet(env.SHOP_CATALOG_V2_CANARY_BRANDS),
    categories: normalizedSet(env.SHOP_CATALOG_V2_CANARY_CATEGORIES),
  }) satisfies ShopCatalogCanaryConfig;
}

// Stable, runtime-independent FNV-1a bucket. This is rollout allocation, not security.
export function shopCatalogCanaryBucket(rolloutId: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < rolloutId.length; index += 1) {
    hash ^= rolloutId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

export function evaluateShopCatalogCanary(input: {
  config: ShopCatalogCanaryConfig;
  rolloutId: string;
  locale: string | null;
  brand: string | null;
  category: string | null;
}) {
  const locale = input.locale?.trim().toLowerCase() ?? "";
  const brand = input.brand?.trim().toLowerCase() ?? "";
  const category = input.category?.trim().toLowerCase() ?? "";
  if (!input.rolloutId || input.config.percentage <= 0) return false;
  if (input.config.locales.size && !input.config.locales.has(locale)) return false;
  if (input.config.brands.size && !input.config.brands.has(brand)) return false;
  if (input.config.categories.size && !input.config.categories.has(category)) return false;
  return shopCatalogCanaryBucket(input.rolloutId) < input.config.percentage;
}
