import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { assertAdminRequest } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY_RATES, normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";

export async function GET() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);

    const settings = await prisma.shopSettings.findUnique({
      where: { key: "shop" },
      select: { currencyRates: true },
    });

    return NextResponse.json({
      currencyRates: normalizeShopCurrencyRates(settings?.currencyRates ?? DEFAULT_CURRENCY_RATES),
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
