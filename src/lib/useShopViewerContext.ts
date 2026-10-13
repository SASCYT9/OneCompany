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
  group?: CustomerGroup | null;
  b2bDiscountPercent?: number | null;
  /** True while an admin browses as this customer ("log in as customer"). */
  impersonating?: boolean;
  system: Array<{ brand: string; discountPct: number }>;
  customer: Array<{ brand: string; discountPct: number }>;
};

const IMPERSONATION_MARKER_COOKIE = "oc-shop-impersonation-active";
const IMPERSONATION_REQUEST_KEY = "impersonation";

const brandDiscountRequests = new Map<string, Promise<BrandDiscountPayload | null>>();

function hasImpersonationMarker() {
  return document.cookie
    .split(";")
    .some((entry) => entry.trim() === `${IMPERSONATION_MARKER_COOKIE}=1`);
}

/** `customerId` is null while impersonating: the server decides who it is. */
function loadBrandDiscounts(customerId: string | null) {
  const requestKey = customerId ?? IMPERSONATION_REQUEST_KEY;
  const cached = brandDiscountRequests.get(requestKey);
  if (cached) return cached;
  const request = fetch("/api/shop/pricing-context", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = (await response.json()) as BrandDiscountPayload;
      if (customerId == null) return payload.impersonating ? payload : null;
      return payload.customerId === customerId ? payload : null;
    })
    .catch(() => null)
    .finally(() => {
      // Deduplicate components mounting together, but never retain customer
      // pricing across a later navigation after an admin change.
      brandDiscountRequests.delete(requestKey);
    });
  brandDiscountRequests.set(requestKey, request);
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
    if (!mounted) return;
    const customerId = session?.user?.customerId;
    // The impersonation overlay is server-side only: NextAuth here still holds
    // the admin's own (usually anonymous) browser session.
    const impersonating = hasImpersonationMarker();
    const approvedSession =
      status === "authenticated" && session?.user?.group === "B2B_APPROVED" && customerId;
    if (!impersonating && !approvedSession) {
      setBrandDiscounts(null);
      return;
    }
    let active = true;
    void loadBrandDiscounts(impersonating ? null : (customerId ?? null)).then((payload) => {
      if (active) setBrandDiscounts(payload);
    });
    return () => {
      active = false;
    };
  }, [mounted, session?.user?.customerId, session?.user?.group, status]);

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

    if (mounted && brandDiscounts?.impersonating) {
      return {
        ...regionalBaseline,
        customerGroup: brandDiscounts.group ?? null,
        customerB2BDiscountPercent: brandDiscounts.b2bDiscountPercent ?? null,
        isAuthenticated: true,
        systemBrandDiscountMap: toDiscountMap(brandDiscounts.system),
        customerBrandDiscountMap: toDiscountMap(brandDiscounts.customer),
      };
    }

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
