export const SHOP_CURRENCIES = ["EUR", "USD", "UAH"] as const;
export type ShopCurrencyCode = (typeof SHOP_CURRENCIES)[number];

export const DEFAULT_CURRENCY_RATES: Record<ShopCurrencyCode, number> = {
  EUR: 1,
  USD: 1.152174,
  UAH: 53,
};
