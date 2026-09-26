import { DEFAULT_CURRENCY_RATES } from "@/lib/shopCurrencyDefaults";

type CurrencyRates = { EUR: number; USD: number; UAH: number };

export function roundWheelForceCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWheelForcePrices(sourceGrossEur: number, rates: CurrencyRates) {
  if (!Number.isFinite(sourceGrossEur) || sourceGrossEur <= 0) {
    throw new Error("WheelForce source price must be positive");
  }
  const ukraineEur = roundWheelForceCents(sourceGrossEur * 1.10);
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
