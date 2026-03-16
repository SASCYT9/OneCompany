"use client";

import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { ShopMoneySet } from "@/lib/shopCatalog";

type Props = {
  locale: "ua" | "en";
  isUa: boolean;
  price: ShopMoneySet;
};

function formatPrice(locale: "ua" | "en", amount: number, currency: "EUR" | "USD" | "UAH") {
  const effectiveLocale = locale === "ua" ? "uk-UA" : "en-US";
  const formattedAmount = new Intl.NumberFormat(effectiveLocale, {
    maximumFractionDigits: 0,
  }).format(amount);

  if (locale === "ua") {
    if (currency === "UAH") return `${formattedAmount} грн`;
    return `${formattedAmount} ${currency}`;
  }

  return `${currency} ${formattedAmount}`;
}

export function ShopPrimaryPriceBox({ locale, isUa, price }: Props) {
  const { currency, rates } = useShopCurrency();

  const hasValid = (value?: number | null) => typeof value === "number" && value > 0;

  const amountEur = price.eur;
  const amountUah = price.uah;
  const amountUsd = price.usd;

  const computedUsd =
    !hasValid(amountUsd) && rates && hasValid(amountUah)
      ? amountUah / rates.USD
      : amountUsd;

  const computedEur =
    !hasValid(amountEur) && rates && hasValid(amountUah)
      ? amountUah / rates.EUR
      : amountEur;

  const displayAmount =
    currency === "USD"
      ? computedUsd && computedUsd > 0
        ? computedUsd
        : computedEur
      : currency === "EUR"
        ? computedEur && computedEur > 0
          ? computedEur
          : amountUah
        : amountUah;

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
        {isUa ? "Ціна" : "Pricing"}
      </p>
      <p className="mt-2 text-3xl font-light">
        {currency === "USD" &&
          formatPrice(locale, displayAmount, "USD")}
        {currency === "EUR" &&
          formatPrice(locale, displayAmount, "EUR")}
        {currency === "UAH" &&
          formatPrice(locale, displayAmount, "UAH")}
      </p>
      <p className="text-sm text-white/60">
        {formatPrice(locale, computedUsd && computedUsd > 0 ? computedUsd : price.usd || 0, "USD")}{" "}
        / {formatPrice(locale, computedEur && computedEur > 0 ? computedEur : price.eur, "EUR")}{" "}
        / {formatPrice(locale, amountUah, "UAH")}
      </p>
    </>
  );
}

