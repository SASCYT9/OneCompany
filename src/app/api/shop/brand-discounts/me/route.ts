import { NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { prisma } from "@/lib/prisma";
import { loadBrandDiscountMap, loadCustomerBrandDiscountMap } from "@/lib/shopBrandB2bDiscounts";

/**
 * GET /api/shop/brand-discounts/me
 *
 * Returns the resolved brand-discount maps the current viewer should see:
 *   - `system`   — system-wide ShopBrandB2bDiscount entries (applies to
 *                  every B2B customer).
 *   - `customer` — per-customer overrides for the logged-in customer
 *                  (ShopCustomerBrandDiscount).
 *
 * Both are dictionaries: `lowercased-brand-slug → discount-percent`.
 *
 * Consumed by the client-side `useShopViewerContext` hook so per-brand
 * pricing applies on every brand-storefront page (Akrapovic, Brabus,
 * Ilmberger, etc.) without an SSR re-fetch.
 *
 * Returns empty `customer` for guest viewers — only the public-safe
 * system map is exposed.
 */
export async function GET() {
  try {
    const session = await getCurrentShopCustomerSession();
    const customerId = session?.customerId ?? null;
    const [systemMap, customerMap] = await Promise.all([
      loadBrandDiscountMap(prisma),
      loadCustomerBrandDiscountMap(prisma, customerId),
    ]);
    return NextResponse.json({
      system: Object.fromEntries(systemMap),
      customer: Object.fromEntries(customerMap),
    });
  } catch (error: any) {
    console.error("[brand-discounts/me] failed", error);
    return NextResponse.json({ system: {}, customer: {}, error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
