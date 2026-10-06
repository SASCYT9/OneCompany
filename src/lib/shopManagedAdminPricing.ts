import { managedAdminPriceChange } from "./shopAdminPriceConversion";
import { repriceShopSourceMoney, type ShopPriceBookRates } from "./shopPriceBookCurrency";
import type { ShopCurrencyCode } from "./shopCurrencyDefaults";

export const SHOP_ADMIN_PRICE_BANDS = [
  [
    "priceSourceCurrency",
    ["priceEur", "priceUsd", "priceUah"],
    ["multiplyEur", "multiplyUsd", "multiplyUah"],
  ],
  [
    "b2bPriceSourceCurrency",
    ["priceEurB2b", "priceUsdB2b", "priceUahB2b"],
    ["multiplyEurB2b", "multiplyUsdB2b", "multiplyUahB2b"],
  ],
  ["compareAtSourceCurrency", ["compareAtEur", "compareAtUsd", "compareAtUah"], []],
  ["b2bCompareAtSourceCurrency", ["compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"], []],
] as const;
const currencies = ["EUR", "USD", "UAH"] as const;
const invalid = (message: string): never => {
  throw new Error("MANAGED_PRICE_PATCH_INVALID:" + message);
};

/** An absolute edit selects its native currency; multipliers retain the saved native source. */
export function managedAdminPricingPatch(record: object, input: object, rates: ShopPriceBookRates) {
  const result: Record<string, number | string | null> = {};
  for (const [source, fields, multipliers] of SHOP_ADMIN_PRICE_BANDS) {
    const absolute = fields
      .map((field, index) => ({
        field,
        index,
        value: Reflect.get(input, field) as number | null | undefined,
      }))
      .filter((item) => item.value !== undefined);
    const factors = multipliers
      .map((field) => Reflect.get(input, field) as number | null | undefined)
      .filter((value): value is number => value != null);
    if (!absolute.length && !factors.length) continue;
    if (
      absolute.some(
        (item) => item.value != null && (!Number.isFinite(item.value) || item.value < 0)
      ) ||
      factors.some((value) => !Number.isFinite(value) || value < 0)
    )
      invalid("Ціна та множник мають бути невід'ємними числами.");
    if (absolute.length && factors.length)
      invalid("Задайте ціну або множник для однієї групи цін.");
    let amount: number;
    let currency: ShopCurrencyCode;
    if (absolute.length) {
      const positive = absolute.filter((item) => item.value != null && item.value > 0);
      const owned = fields
        .map((field, index) => ({ index, value: Number(Reflect.get(record, field) ?? 0) }))
        .filter((item) => item.value > 0);
      const declared =
        Reflect.get(record, source) ??
        (owned.length === 1 ? currencies[owned[0].index] : undefined);
      const selected =
        positive.length === 1
          ? positive[0]
          : positive.find((item) => currencies[item.index] === declared);
      if (!positive.length) {
        for (const field of fields) result[field] = null;
        result[source] = null;
        continue;
      }
      if (!selected) return invalid("Оберіть одну валюту для нової групи цін.");
      currency = currencies[selected.index];
      amount = Math.round((Number(selected.value) + Number.EPSILON) * 100) / 100;
    } else {
      if (new Set(factors).size !== 1)
        invalid("Використовуйте однаковий множник для валют однієї групи цін.");
      const values = fields.map((field) => Number(Reflect.get(record, field) ?? 0));
      if (!values.some((value) => value > 0)) continue; // Preserve variant inheritance.
      const declared = Reflect.get(record, source);
      const money = repriceShopSourceMoney(
        {
          eur: values[0],
          usd: values[1],
          uah: values[2],
          ...(currencies.includes(declared as ShopCurrencyCode)
            ? { sourceCurrency: declared as ShopCurrencyCode }
            : {}),
        },
        rates
      );
      currency = money.sourceCurrency!;
      amount =
        Math.round((values[currencies.indexOf(currency)] * factors[0] + Number.EPSILON) * 100) /
        100;
    }
    const changed = managedAdminPriceChange(amount, currency, rates)!;
    if (
      absolute.length &&
      absolute.filter((item) => item.value != null && item.value > 0).length > 1
    ) {
      for (const item of absolute)
        if (
          item.value != null &&
          item.value > 0 &&
          Math.abs(
            item.value -
              Number(changed[currencies[item.index].toLowerCase() as "eur" | "usd" | "uah"])
          ) > 0.000001
        )
          invalid("Ціни в різних валютах мають відповідати вихідній валюті та поточному курсу.");
    }
    result[source] = changed.sourceCurrency || null;
    for (let index = 0; index < fields.length; index++)
      result[fields[index]] = changed.sourceCurrency
        ? Number(changed[currencies[index].toLowerCase() as "eur" | "usd" | "uah"])
        : null;
  }
  return result;
}
