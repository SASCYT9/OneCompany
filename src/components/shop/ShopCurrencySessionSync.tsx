"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import type { ShopCurrencyCode } from "@/lib/shopAdminSettings";
import { useShopCurrency } from "@/components/shop/CurrencyContext";

function isShopCurrencyCode(value: unknown): value is ShopCurrencyCode {
  return value === "UAH" || value === "EUR" || value === "USD";
}

export function ShopCurrencySessionSync() {
  const { data: session, status } = useSession();
  const { setCurrency } = useShopCurrency();

  useEffect(() => {
    const preference = session?.user?.currencyPref;
    if (status === "authenticated" && isShopCurrencyCode(preference)) {
      setCurrency(preference);
    }
  }, [session?.user?.currencyPref, setCurrency, status]);

  return null;
}
