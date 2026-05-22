"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { CustomerGroup } from "@prisma/client";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";

const ANON_FALLBACK: ShopViewerPricingContext = {
  customerGroup: null,
  customerB2BDiscountPercent: null,
  defaultB2BDiscountPercent: null,
  b2bVisibilityMode: "public",
  isAuthenticated: false,
};

type BrandMapPair = {
  systemBrandDiscountMap: ReadonlyMap<string, number>;
  customerBrandDiscountMap: ReadonlyMap<string, number>;
};

const EMPTY_MAPS: BrandMapPair = {
  systemBrandDiscountMap: new Map(),
  customerBrandDiscountMap: new Map(),
};

// Module-level cache so a single brand-shop session shares the same maps
// across every product card / detail layout that mounts the hook.
let cachedMaps: BrandMapPair | null = null;
let cachedPromise: Promise<BrandMapPair> | null = null;

async function fetchBrandMaps(): Promise<BrandMapPair> {
  const res = await fetch("/api/shop/brand-discounts/me", { cache: "no-store" });
  if (!res.ok) return EMPTY_MAPS;
  const data = (await res.json()) as {
    system?: Record<string, number>;
    customer?: Record<string, number>;
  };
  return {
    systemBrandDiscountMap: new Map(Object.entries(data.system ?? {})),
    customerBrandDiscountMap: new Map(Object.entries(data.customer ?? {})),
  };
}

/**
 * Client-side variant of the server's `buildShopViewerPricingContext`.
 *
 * Server pages render with an *anonymous* initial context so the HTML can be
 * cached (ISR). On the client, this hook reads the active NextAuth session
 * and overrides only the per-user fields. Anonymous visitors keep the cached
 * SSR output verbatim; B2B-approved users see prices recompute right after
 * hydration (~50–200 ms, no layout shift since the markup shape is identical).
 *
 * Per-brand discount maps (ShopBrandB2bDiscount + ShopCustomerBrandDiscount)
 * are fetched lazily once per session and cached in module scope, so brand
 * pages like /shop/akrapovic/products/X reflect "Akrapovic = −15%" set in
 * the admin without an extra round-trip per render.
 *
 * Pass the SSR-rendered viewerContext (or undefined — falls back to anon).
 */
export function useShopViewerContext(initial?: ShopViewerPricingContext): ShopViewerPricingContext {
  const { data: session, status } = useSession();
  const baseline = initial ?? ANON_FALLBACK;
  const [brandMaps, setBrandMaps] = useState<BrandMapPair>(() => cachedMaps ?? EMPTY_MAPS);

  useEffect(() => {
    // Anonymous viewers: nothing to fetch (system map is harmless to expose
    // but irrelevant — non-B2B viewers always get retail prices).
    if (status !== "authenticated") return;
    if (cachedMaps) {
      setBrandMaps(cachedMaps);
      return;
    }
    if (!cachedPromise) {
      cachedPromise = fetchBrandMaps()
        .then((maps) => {
          cachedMaps = maps;
          return maps;
        })
        .catch(() => EMPTY_MAPS);
    }
    let alive = true;
    cachedPromise.then((maps) => {
      if (alive) setBrandMaps(maps);
    });
    return () => {
      alive = false;
    };
  }, [status]);

  return useMemo<ShopViewerPricingContext>(() => {
    if (status !== "authenticated" || !session?.user) {
      return baseline;
    }

    const user = session.user;
    return {
      ...baseline,
      customerGroup: (user.group as CustomerGroup | null) ?? baseline.customerGroup,
      customerB2BDiscountPercent: user.b2bDiscountPercent ?? baseline.customerB2BDiscountPercent,
      isAuthenticated: true,
      systemBrandDiscountMap: brandMaps.systemBrandDiscountMap,
      customerBrandDiscountMap: brandMaps.customerBrandDiscountMap,
    };
  }, [baseline, session, status, brandMaps]);
}
