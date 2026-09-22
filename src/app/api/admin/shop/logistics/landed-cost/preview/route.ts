import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import {
  calculateShopLandedCost,
  normalizeShopLandedCostRule,
  type ShopLandedCostRule,
} from "@/lib/shopLandedCost";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rule = normalizeShopLandedCostRule((body.rule ?? {}) as Partial<ShopLandedCostRule>);
    const country = String(body.country ?? rule.regionCode ?? "").trim();
    const currency = String(body.currency ?? "EUR")
      .trim()
      .toUpperCase();

    return NextResponse.json(
      calculateShopLandedCost({
        rule,
        country,
        currency,
        subtotal: Number(body.subtotal ?? 0),
        shippingCost: Number(body.shippingCost ?? 0),
        taxableSubtotal: Number(body.taxableSubtotal ?? body.subtotal ?? 0),
        taxableShippingCost: Number(body.taxableShippingCost ?? body.shippingCost ?? 0),
      })
    );
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin landed cost preview", error);
    return NextResponse.json({ error: "Failed to calculate landed cost" }, { status: 500 });
  }
}
