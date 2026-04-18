"use client";

import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { ShopMoneySet } from "@/lib/shopCatalog";
import { formatShopMoney } from "@/lib/shopMoneyFormat";
import type { SupportedLocale } from "@/lib/seo";

type Props = {
  locale: SupportedLocale;
  price: ShopMoneySet;
  className?: string;
  requestLabel?: string;
};

function hasValidAmount(value?: number | null) {
  return typeof value === "number" && value > 0;
}

export function ShopInlinePriceText({
  locale,
  price,
  className,
  requestLabel,
}: Props) {
  const { currency, rates } = useShopCurrency();

  let computedUah = price.uah || 0;
  let computedEur = price.eur || 0;
  let computedUsd = price.usd || 0;

  if (hasValidAmount(price.uah) && rates) {
    if (!hasValidAmount(computedEur)) computedEur = (price.uah / rates.UAH) * rates.EUR;
    if (!hasValidAmount(computedUsd)) computedUsd = (price.uah / rates.UAH) * rates.USD;
  } else if (hasValidAmount(price.eur) && rates) {
    if (!hasValidAmount(computedUah)) computedUah = (price.eur / rates.EUR) * rates.UAH;
    if (!hasValidAmount(computedUsd)) computedUsd = (price.eur / rates.EUR) * rates.USD;
  } else if (hasValidAmount(price.usd) && rates) {
    if (!hasValidAmount(computedUah)) computedUah = (price.usd / rates.USD) * rates.UAH;
    if (!hasValidAmount(computedEur)) computedEur = (price.usd / rates.USD) * rates.EUR;
  }

  const displayAmount =
    currency === "USD" ? computedUsd : currency === "EUR" ? computedEur : computedUah;

  if (!hasValidAmount(displayAmount)) {
    return <span className={className}>{requestLabel ?? "Price on request"}</span>;
  }

  return <span className={className}>{formatShopMoney(locale, displayAmount, currency)}</span>;
}
