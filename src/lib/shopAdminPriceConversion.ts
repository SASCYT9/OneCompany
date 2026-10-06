import {
  isShopSourcePriceBook,
  repriceShopSourceMoney,
  shopUahSaleRate,
  type ShopPriceBookRates,
} from "./shopPriceBookCurrency";
import type { ShopCurrencyCode } from "./shopCurrencyDefaults";

/** Editing a native price records that currency as the new per-band source. */
export function managedAdminPriceChange(
  value: number,
  currency: ShopCurrencyCode,
  rates: Record<string, number>
) {
  if (!isShopSourcePriceBook(rates) || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return { eur: "", usd: "", uah: "", sourceCurrency: "" as const };
  const result = repriceShopSourceMoney(
    {
      eur: currency === "EUR" ? value : 0,
      usd: currency === "USD" ? value : 0,
      uah: currency === "UAH" ? value : 0,
      sourceCurrency: currency,
    },
    rates as ShopPriceBookRates
  );
  return {
    eur: String(result.eur),
    usd: String(result.usd),
    uah: String(result.uah),
    sourceCurrency: currency,
  };
}

export function managedAdminSourceSelection(
  form: object,
  sourceField: string,
  currency: string,
  rates: Record<string, number>
) {
  const groups: Record<string, readonly string[]> = {
    priceSourceCurrency: ["priceEur", "priceUsd", "priceUah"],
    compareAtSourceCurrency: ["compareAtEur", "compareAtUsd", "compareAtUah"],
    b2bPriceSourceCurrency: ["priceEurB2b", "priceUsdB2b", "priceUahB2b"],
    b2bCompareAtSourceCurrency: ["compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"],
  };
  const group = groups[sourceField];
  const index = ["EUR", "USD", "UAH"].indexOf(currency);
  if (!group || index < 0) return null;
  const amount = Number(Reflect.get(form, group[index]));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const result = managedAdminPriceChange(amount, currency as ShopCurrencyCode, rates);
  return result
    ? {
        [sourceField]: currency,
        [group[0]]: result.eur,
        [group[1]]: result.usd,
        [group[2]]: result.uah,
      }
    : null;
}

/** Copy every amount with its source, including an explicitly cleared band. */
export function managedAdminPriceBandUpdates(
  form: object,
  includeEmpty = true
): Record<string, string> {
  const updates: Record<string, string> = {};
  const groups = [
    ["priceSourceCurrency", "priceEur", "priceUsd", "priceUah"],
    ["compareAtSourceCurrency", "compareAtEur", "compareAtUsd", "compareAtUah"],
    ["b2bPriceSourceCurrency", "priceEurB2b", "priceUsdB2b", "priceUahB2b"],
    ["b2bCompareAtSourceCurrency", "compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"],
  ];
  for (const [source, ...amounts] of groups) {
    if (Reflect.get(form, source) === undefined) continue;
    if (!includeEmpty && !amounts.some((field) => Number(Reflect.get(form, field)) > 0)) continue;
    for (const field of [source, ...amounts])
      updates[field] = String(Reflect.get(form, field) ?? "");
  }
  return updates;
}

export function adminPriceBookDescription(rates: Record<string, number>) {
  return isShopSourcePriceBook(rates)
    ? `EUR/USD: ${rates.USD.toFixed(6)}. Курс продажу: EUR ${shopUahSaleRate("EUR", rates as ShopPriceBookRates).toFixed(4)} грн; USD ${shopUahSaleRate("USD", rates as ShopPriceBookRates).toFixed(4)} грн. Перерахунок від вихідної валюти.`
    : `При зміні однієї валюти інші оновлюються автоматично. Курс: 1 EUR = ${rates.USD} USD = ${rates.UAH} UAH`;
}
