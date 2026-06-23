"use client";

import { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { CustomerGroup } from "@prisma/client";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import {
  getShopPriceCountryForCountry,
  getShopPriceCountryForRegion,
  useShopCurrency,
} from "@/components/shop/CurrencyContext";

const ANON_FALLBACK: ShopViewerPricingContext = {
  customerGroup: null,
  customerB2BDiscountPercent: null,
  defaultB2BDiscountPercent: null,
  b2bVisibilityMode: "public",
  isAuthenticated: false,
  priceCountry: null,
};

/**
 * Client-side variant of the server's `buildShopViewerPricingContext`.
 *
 * Server pages render with an *anonymous* initial context so the HTML can be
 * cached (ISR). On the client, this hook reads the active NextAuth session
 * and overrides only the per-user fields. Anonymous visitors keep the cached
 * SSR output verbatim; B2B-approved users see prices recompute right after
 * hydration (~50–200 ms, no layout shift since the markup shape is identical).
 *
 * Pass the SSR-rendered viewerContext (or undefined — falls back to anon).
 */
export function useShopViewerContext(initial?: ShopViewerPricingContext): ShopViewerPricingContext {
  const { data: session, status } = useSession();
  const { country, region } = useShopCurrency();
  const baseline = initial ?? ANON_FALLBACK;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return useMemo<ShopViewerPricingContext>(() => {
    const priceCountry = mounted
      ? (getShopPriceCountryForCountry(country) ??
        getShopPriceCountryForRegion(region) ??
        baseline.priceCountry)
      : baseline.priceCountry;
    const regionalBaseline = {
      ...baseline,
      priceCountry,
    };

    if (!mounted || status !== "authenticated" || !session?.user) {
      return regionalBaseline;
    }

    const user = session.user;
    return {
      ...regionalBaseline,
      customerGroup: (user.group as CustomerGroup | null) ?? baseline.customerGroup,
      customerB2BDiscountPercent: user.b2bDiscountPercent ?? baseline.customerB2BDiscountPercent,
      isAuthenticated: true,
    };
  }, [baseline, session, status, mounted, country, region]);
}
