/**
 * PUT / DELETE /api/admin/shop/b2b/tariff-groups/[id]/brand-discounts
 *
 * A tariff group's discount on one brand. It beats the brand rule for every
 * partner; a partner's own rule for the same brand still beats it.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  deleteShopB2bTariffGroupBrandDiscount,
  upsertShopB2bTariffGroupBrandDiscount,
} from "@/lib/shopB2bAdmin.server";
import { shopB2bAdminErrorResponse } from "@/lib/shopB2bAdminErrors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { groupName, discount } = await upsertShopB2bTariffGroupBrandDiscount(prisma, id, body);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "b2b.tariff_group.brand_discount.upsert",
      entityType: "shop.b2b_tariff_group",
      entityId: id,
      metadata: { groupName, brand: discount.brand, discountPct: discount.discountPct },
    });
    return NextResponse.json({ discount });
  } catch (error) {
    return shopB2bAdminErrorResponse(error, "Admin B2B tariff group brand discount");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const { id } = await context.params;
    const brand = request.nextUrl.searchParams.get("brand")?.trim() ?? "";
    if (!brand) return NextResponse.json({ error: "Не вказано бренд" }, { status: 400 });
    await deleteShopB2bTariffGroupBrandDiscount(prisma, id, brand);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "b2b.tariff_group.brand_discount.delete",
      entityType: "shop.b2b_tariff_group",
      entityId: id,
      metadata: { brand },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return shopB2bAdminErrorResponse(
      error,
      "Admin B2B tariff group brand discount delete",
      "Не вдалося видалити"
    );
  }
}

export const runtime = "nodejs";
