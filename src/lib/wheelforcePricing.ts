import { DEFAULT_CURRENCY_RATES } from "@/lib/shopCurrencyDefaults";
import {
  isShopSourcePriceBook,
  repriceShopSourceMoney,
  type ShopPriceBookRates,
} from "./shopPriceBookCurrency";

type CurrencyRates = ShopPriceBookRates;

export function buildWheelForcePriceFields(sourceGrossEur: number, rates: CurrencyRates) {
  const prices = calculateWheelForcePrices(sourceGrossEur, rates);
  const local = isShopSourcePriceBook(rates)
    ? repriceShopSourceMoney(
        { eur: prices.ukraine.eur, usd: 0, uah: 0, sourceCurrency: "EUR" },
        rates
      )
    : prices.ukraine;
  return {
    priceSourceCurrency: "EUR" as const,
    priceEur: local.eur,
    priceUsd: local.usd,
    priceUah: local.uah,
    priceEurEurope: prices.europe.eur,
  };
}

export function roundWheelForceCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWheelForcePrices(sourceGrossEur: number, rates: CurrencyRates) {
  if (!Number.isFinite(sourceGrossEur) || sourceGrossEur <= 0) {
    throw new Error("WheelForce source price must be positive");
  }
  const ukraineEur = roundWheelForceCents(sourceGrossEur * 1.1);
  const europeNetEur = roundWheelForceCents(sourceGrossEur / 1.19);
  const usdRate = rates.USD || DEFAULT_CURRENCY_RATES.USD;
  const uahRate = rates.UAH || DEFAULT_CURRENCY_RATES.UAH;
  return {
    ukraine: {
      eur: ukraineEur,
      usd: Math.round(ukraineEur * usdRate),
      uah: Math.round(ukraineEur * uahRate),
    },
    europe: {
      eur: europeNetEur,
      usd: Math.round(europeNetEur * usdRate),
      uah: Math.round(europeNetEur * uahRate),
    },
  };
}
