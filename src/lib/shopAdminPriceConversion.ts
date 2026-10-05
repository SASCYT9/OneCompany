import { repriceShopSourceMoney, shopUahSaleRate, type ShopPriceBookRates } from "./shopPriceBookCurrency";
import type { ShopCurrencyCode } from "./shopCurrencyDefaults";

/** Editing a native price records that currency as the new per-band source. */
export function managedAdminPriceChange(
  value: number,
  currency: ShopCurrencyCode,
  rates: Record<string, number>
) {
  if (rates._uahReserve !== 1 || !Number.isFinite(value) || value <= 0) return null;
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

export function managedAdminSourceSelection(form: object, sourceField: string, currency: string, rates: Record<string,number>) {
  const groups: Record<string,readonly string[]> = {
    priceSourceCurrency:['priceEur','priceUsd','priceUah'],
    compareAtSourceCurrency:['compareAtEur','compareAtUsd','compareAtUah'],
    b2bPriceSourceCurrency:['priceEurB2b','priceUsdB2b','priceUahB2b'],
    b2bCompareAtSourceCurrency:['compareAtEurB2b','compareAtUsdB2b','compareAtUahB2b'],
  };
  const group=groups[sourceField];const index=['EUR','USD','UAH'].indexOf(currency);
  if(!group||index<0)return null;
  const result=managedAdminPriceChange(Number(Reflect.get(form,group[index])),currency as ShopCurrencyCode,rates);
  return result?{[sourceField]:currency,[group[0]]:result.eur,[group[1]]:result.usd,[group[2]]:result.uah}:null;
}

export function adminPriceBookDescription(rates:Record<string,number>) {
  return rates._uahReserve===1
    ? `EUR/USD: ${rates.USD.toFixed(6)}. Курс продажу: EUR ${shopUahSaleRate('EUR',rates as ShopPriceBookRates).toFixed(4)} грн; USD ${shopUahSaleRate('USD',rates as ShopPriceBookRates).toFixed(4)} грн. Перерахунок від вихідної валюти.`
    : `При зміні однієї валюти інші оновлюються автоматично. Курс: 1 EUR = ${rates.USD} USD = ${rates.UAH} UAH`;
}
