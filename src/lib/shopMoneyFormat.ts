import type { SupportedLocale } from "@/lib/seo";

export type ShopCurrencyCode = "EUR" | "USD" | "UAH";

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

