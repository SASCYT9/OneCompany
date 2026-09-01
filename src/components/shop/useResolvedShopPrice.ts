"use client";

import { useMemo } from "react";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import type { ShopMoneySet } from "@/lib/shopCatalog";
import {
  resolveShopPriceBands,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";

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
  /** Optional European retail band, selected from the viewer's active country. */
  europePrice?: Partial<ShopMoneySet> | null;
  /** Optional retail / MSRP band. */
  compareAt?: Partial<ShopMoneySet> | null;
  /** Optional explicit B2B price from product fields (overrides percentage). */
  b2bExplicit?: Partial<ShopMoneySet> | null;
  b2bCompareAt?: Partial<ShopMoneySet> | null;
  /** Product brand — enables 4-tier per-brand discount lookup. */
  brand?: string | null;
  initialViewerContext?: ShopViewerPricingContext;
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
export function useResolvedShopPrice({
  b2cPrice,
  europePrice,
  compareAt,
  b2bExplicit,
  b2bCompareAt,
  brand,
  initialViewerContext,
}: Params): ResolvedShopPrice {
  const viewer = useShopViewerContext(initialViewerContext);

  return useMemo<ResolvedShopPrice>(() => {
    const pricing = resolveShopPriceBands({
      b2cPrice,
      europePrice,
      b2cCompareAt: compareAt,
      b2bPrice: b2bExplicit,
      b2bCompareAt,
      context: viewer,
      brand,
    });
    return {
      effective: pricing.effectivePrice,
      retail: pricing.effectiveCompareAt,
      discountPct: pricing.discountPercent ?? 0,
    };
  }, [
    b2cPrice,
    europePrice,
    compareAt,
    b2bExplicit,
    b2bCompareAt,
    brand,
    viewer,
  ]);
}
