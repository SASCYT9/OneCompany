import type { SupportedLocale } from "@/lib/seo";

export type ShopCurrencyCode = "EUR" | "USD" | "UAH";

export type ShopPriceSet = {
  eur: number;
  usd: number;
  uah: number;
};

/**
 * EUR-based currency rates: rates.X = how many X per 1 EUR.
 * rates.EUR is always 1; rates.USD ≈ 1.08; rates.UAH ≈ 45.
 */
export type ShopCurrencyRates = {
  EUR: number;
  USD: number;
  UAH: number;
};

/**
 * Convert a multi-currency price to the target currency.
 *
 * Strategy: prefer direct value when stored, otherwise pivot through EUR (base).
 * All rates are interpreted as "X per 1 EUR" — see `DEFAULT_CURRENCY_RATES`.
 */
export function convertShopMoney(
  price: ShopPriceSet | null | undefined,
  target: ShopCurrencyCode,
  rates: ShopCurrencyRates | null | undefined,
): number {
  if (!price) return 0;

  const direct = target === "USD" ? price.usd : target === "UAH" ? price.uah : price.eur;
  if (direct > 0) return direct;

  // Fallback: pivot through EUR (base currency)
  const eurRate = rates?.EUR && rates.EUR > 0 ? rates.EUR : 1;
  const usdRate = rates?.USD && rates.USD > 0 ? rates.USD : 0;
  const uahRate = rates?.UAH && rates.UAH > 0 ? rates.UAH : 0;

  let inEur = 0;
  if (price.eur > 0) {
    inEur = price.eur / eurRate; // EUR rate is 1, but kept for symmetry
  } else if (price.usd > 0 && usdRate > 0) {
    inEur = price.usd / usdRate;
  } else if (price.uah > 0 && uahRate > 0) {
    inEur = price.uah / uahRate;
  }

  if (inEur <= 0) return 0;

  if (target === "EUR") return Math.round(inEur * 100) / 100;
  if (target === "USD") return usdRate > 0 ? Math.round(inEur * usdRate * 100) / 100 : 0;
  if (target === "UAH") return uahRate > 0 ? Math.round(inEur * uahRate) : 0;
  return 0;
}

export function formatShopMoney(
  locale: SupportedLocale,
  amount: number,
  currency: ShopCurrencyCode,
) {
  const formattedAmount = new Intl.NumberFormat(
    locale === "ua" ? "uk-UA" : "en-US",
    {
      maximumFractionDigits: 0,
    },
  ).format(amount);

  if (locale === "ua") {
    return `${formattedAmount} ${currency === "UAH" ? "грн" : currency}`;
  }

  return `${currency} ${formattedAmount}`;
}

