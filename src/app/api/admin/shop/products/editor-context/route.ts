import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";
import { assertAdminRequest } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY_RATES, normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";

/** Wholesale terms are commercial data: only admins who may read pricing get them. */
async function readB2bDiscountContext() {
  const [settings, brandDiscounts] = await Promise.all([
    prisma.shopSettings.findUnique({
      where: { key: "shop" },
      select: { defaultB2bDiscountPercent: true },
    }),
    prisma.shopBrandB2bDiscount.findMany({ select: { brand: true, discountPct: true } }),
  ]);
  return {
    defaultB2bDiscountPercent:
      settings?.defaultB2bDiscountPercent == null
        ? null
        : Number(settings.defaultB2bDiscountPercent),
    brandB2bDiscounts: Object.fromEntries(
      brandDiscounts.map((row) => [row.brand.trim().toLowerCase(), Number(row.discountPct)])
    ),
  };
}

export async function GET() {
  try {
    const session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const canReadPricing = matchesAdminPermission(
      session.permissions,
      ADMIN_PERMISSIONS.SHOP_PRICING_READ
    );

    const [settings, b2b] = await Promise.all([
      prisma.shopSettings.findUnique({
        where: { key: "shop" },
        select: { currencyRates: true },
      }),
      canReadPricing ? readB2bDiscountContext() : Promise.resolve(null),
    ]);

    return NextResponse.json({
      currencyRates: normalizeShopCurrencyRates(settings?.currencyRates ?? DEFAULT_CURRENCY_RATES),
      // Lets the price editor show the wholesale price a B2B customer gets when the
      // product has no explicit B2B price (see resolveEffectiveDiscountPercent).
      ...(b2b ?? {}),
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin product editor context get", error);
    return NextResponse.json({ error: "Failed to load product editor context" }, { status: 500 });
  }
}

export const runtime = "nodejs";
