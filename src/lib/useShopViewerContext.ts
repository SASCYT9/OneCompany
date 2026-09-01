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

type BrandDiscountPayload = {
  customerId: string;
  system: Array<{ brand: string; discountPct: number }>;
  customer: Array<{ brand: string; discountPct: number }>;
};

const brandDiscountRequests = new Map<string, Promise<BrandDiscountPayload | null>>();

function loadBrandDiscounts(customerId: string) {
  const cached = brandDiscountRequests.get(customerId);
  if (cached) return cached;
  const request = fetch("/api/shop/pricing-context", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = (await response.json()) as BrandDiscountPayload;
      return payload.customerId === customerId ? payload : null;
    })
    .catch(() => null)
    .finally(() => {
      // Deduplicate components mounting together, but never retain customer
      // pricing across a later navigation after an admin change.
      brandDiscountRequests.delete(customerId);
    });
  brandDiscountRequests.set(customerId, request);
  return request;
}

function toDiscountMap(rows: BrandDiscountPayload["system"]) {
  return new Map(
    rows
      .map((row) => [String(row.brand).trim().toLowerCase(), Number(row.discountPct)] as const)
      .filter(([brand, discount]) => brand && Number.isFinite(discount) && discount >= 0)
  );
}

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
  const [brandDiscounts, setBrandDiscounts] = useState<BrandDiscountPayload | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const customerId = session?.user?.customerId;
    if (status !== "authenticated" || session?.user?.group !== "B2B_APPROVED" || !customerId) {
      setBrandDiscounts(null);
      return;
    }
    let active = true;
    void loadBrandDiscounts(customerId).then((payload) => {
      if (active) setBrandDiscounts(payload);
    });
    return () => {
      active = false;
    };
  }, [session?.user?.customerId, session?.user?.group, status]);

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
      systemBrandDiscountMap: brandDiscounts
        ? toDiscountMap(brandDiscounts.system)
        : regionalBaseline.systemBrandDiscountMap,
      customerBrandDiscountMap: brandDiscounts
        ? toDiscountMap(brandDiscounts.customer)
        : regionalBaseline.customerBrandDiscountMap,
    };
  }, [baseline, session, status, mounted, country, region, brandDiscounts]);
}
