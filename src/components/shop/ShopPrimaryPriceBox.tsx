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

  const amountEur = price.eur || 0;
  const amountUah = price.uah || 0;
  const amountUsd = price.usd || 0;

  let computedUah = amountUah;
  let computedEur = amountEur;
  let computedUsd = amountUsd;

  if (hasValid(amountUah) && rates) {
    if (!hasValid(computedEur)) computedEur = (amountUah / rates.UAH) * rates.EUR;
    if (!hasValid(computedUsd)) computedUsd = (amountUah / rates.UAH) * rates.USD;
  } else if (hasValid(amountEur) && rates) {
    if (!hasValid(computedUah)) computedUah = (amountEur / rates.EUR) * rates.UAH;
    if (!hasValid(computedUsd)) computedUsd = (amountEur / rates.EUR) * rates.USD;
  } else if (hasValid(amountUsd) && rates) {
    if (!hasValid(computedUah)) computedUah = (amountUsd / rates.USD) * rates.UAH;
    if (!hasValid(computedEur)) computedEur = (amountUsd / rates.USD) * rates.EUR;
  }

  const displayAmount =
    currency === "USD" ? computedUsd : currency === "EUR" ? computedEur : computedUah;

  if (!hasValid(displayAmount)) {
    return (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/55 dark:text-foreground/40">
          {isUa ? "Ціна" : "Pricing"}
        </p>
        <p className="mt-2 text-2xl font-light text-foreground/85 dark:text-foreground/70">
          {isUa ? "Ціна за запитом" : "Price on Request"}
        </p>
      </>
    );
  }

  const conversionParts: string[] = [];
  if (currency !== "USD" && hasValid(computedUsd)) {
    conversionParts.push(formatPrice(locale, computedUsd, "USD"));
  }
  if (currency !== "EUR" && hasValid(computedEur)) {
    conversionParts.push(formatPrice(locale, computedEur, "EUR"));
  }
  if (currency !== "UAH" && hasValid(computedUah)) {
    conversionParts.push(formatPrice(locale, computedUah, "UAH"));
  }

  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground/55 dark:text-foreground/40">
        {isUa ? "Ціна" : "Pricing"}
      </p>
      <p className="mt-1.5 text-3xl font-light tracking-tight text-foreground sm:text-4xl">
        {formatPrice(locale, displayAmount, currency)}
      </p>
      {conversionParts.length > 0 ? (
        <p className="mt-1 text-[13px] font-light tracking-wide text-foreground/65 dark:text-foreground/55">
          {conversionParts.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
