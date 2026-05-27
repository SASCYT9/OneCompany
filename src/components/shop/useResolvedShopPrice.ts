"use client";

import { useMemo } from "react";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import type { ShopMoneySet } from "@/lib/shopCatalog";

export type ResolvedShopPrice = {
  /** The price the customer actually pays (dealer price for B2B, retail for B2C). */
  effective: ShopMoneySet;
  /** The strikethrough retail price — non-null ONLY when a discount was applied. */
  retail: ShopMoneySet | null;
  /** Discount percent (0–100). 0 means no discount; non-zero drives the "−X%" badge. */
  discountPct: number;
};

type Params = {
  /** Canonical B2C / retail price. Required. */
  b2cPrice: ShopMoneySet;
  /** Optional explicit B2B price from product fields (overrides percentage). */
  b2bExplicit?: Partial<ShopMoneySet> | null;
  /** Product brand — enables 4-tier per-brand discount lookup. */
  brand?: string | null;
};

/**
 * Single source of truth for client-side B2B-price resolution.
 *
 * Mirrors the 4-tier discount resolution in `src/lib/shopPricingAudience.ts`
 * (`resolveEffectiveDiscountPercent`) but runs on the client using the
 * session-loaded `useShopViewerContext`. The same hook is used by both
 * `ShopPrimaryPriceBox` (detail pages) and `ShopCardPriceTag` (grid cards)
 * so the two views can never drift.
 *
 * Resolution order:
 *   1. Not B2B → returns `{ effective: b2cPrice, retail: null, discountPct: 0 }`.
 *   2. Explicit B2B override (`b2bExplicit`) → effective uses overrides,
 *      retail = b2cPrice, discountPct = 0 (no badge — only strikethrough).
 *   3. Per-customer per-brand percent → applies pct to b2cPrice.
 *   4. System per-brand percent → applies pct.
 *   5. Per-customer global percent → applies pct.
 *   6. No discount → returns `{ effective: b2cPrice, retail: null, discountPct: 0 }`.
 *
 * NOTE: caller MUST pass `b2cPrice` (the retail baseline). Discount % is
 * always applied to this baseline, never to a previously-discounted price.
 */
export function useResolvedShopPrice({ b2cPrice, b2bExplicit, brand }: Params): ResolvedShopPrice {
  const viewer = useShopViewerContext();

  return useMemo<ResolvedShopPrice>(() => {
    // Guest / B2C — no discount path runs.
    if (viewer.customerGroup !== "B2B_APPROVED") {
      return { effective: b2cPrice, retail: null, discountPct: 0 };
    }

    // Explicit B2B override on the product wins outright. Strikethrough
    // shows b2cPrice; no percentage badge (price is a flat override).
    if (b2bExplicit && (b2bExplicit.eur || b2bExplicit.usd || b2bExplicit.uah)) {
      const eff: ShopMoneySet = {
        eur: Number(b2bExplicit.eur ?? 0) || b2cPrice.eur || 0,
        usd: Number(b2bExplicit.usd ?? 0) || b2cPrice.usd || 0,
        uah: Number(b2bExplicit.uah ?? 0) || b2cPrice.uah || 0,
      };
      return { effective: eff, retail: b2cPrice, discountPct: 0 };
    }

    // 4-tier percent lookup. Mirrors resolveEffectiveDiscountPercent
    // in `src/lib/shopPricingAudience.ts`.
    const key = String(brand ?? "")
      .trim()
      .toLowerCase();
    let pct = 0;
    if (key) {
      const c = viewer.customerBrandDiscountMap?.get(key);
      if (c != null) pct = c;
      else {
        const s = viewer.systemBrandDiscountMap?.get(key);
        if (s != null) pct = s;
      }
    }
    if (pct === 0) pct = Number(viewer.customerB2BDiscountPercent ?? 0);
    if (pct <= 0) {
      return { effective: b2cPrice, retail: null, discountPct: 0 };
    }

    const mul = 1 - pct / 100;
    const eff: ShopMoneySet = {
      eur: b2cPrice.eur > 0 ? Math.round(b2cPrice.eur * mul * 100) / 100 : 0,
      usd: b2cPrice.usd > 0 ? Math.round(b2cPrice.usd * mul * 100) / 100 : 0,
      uah: b2cPrice.uah > 0 ? Math.round(b2cPrice.uah * mul) : 0,
    };
    return { effective: eff, retail: b2cPrice, discountPct: pct };
  }, [
    b2cPrice,
    b2bExplicit,
    brand,
    viewer.customerGroup,
    viewer.customerB2BDiscountPercent,
    viewer.systemBrandDiscountMap,
    viewer.customerBrandDiscountMap,
  ]);
}
