import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { loadShopB2bCustomerPricingTerms } from "@/lib/shopB2bAdmin.server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/shop/customers/[id]/pricing-terms — the partner's discount
 * rules, so admin orders and proformas price lines exactly like the storefront.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    const { id } = await context.params;
    const terms = await loadShopB2bCustomerPricingTerms(prisma, id);
    if (!terms) return NextResponse.json({ error: "Клієнта не знайдено" }, { status: 404 });
    return NextResponse.json({ terms }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin customer pricing terms", error);
    return NextResponse.json({ error: "Не вдалося завантажити умови" }, { status: 500 });
  }
}

export const runtime = "nodejs";
