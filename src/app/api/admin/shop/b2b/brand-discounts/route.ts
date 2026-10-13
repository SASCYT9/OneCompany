/**
 * GET / PUT / DELETE /api/admin/shop/b2b/brand-discounts
 *
 * Brand discounts for every approved B2B partner (ShopBrandB2bDiscount). A
 * partner's own rule for the same brand (ShopCustomerBrandDiscount) wins.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  deleteSystemBrandDiscount,
  listSystemBrandDiscounts,
  upsertSystemBrandDiscount,
} from "@/lib/shopB2bAdmin.server";
import { shopB2bAdminErrorResponse } from "@/lib/shopB2bAdminErrors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    return NextResponse.json({ discounts: await listSystemBrandDiscounts(prisma) });
  } catch (error) {
    return mapError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const discount = await upsertSystemBrandDiscount(prisma, body);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "b2b.brand_discount.upsert",
      entityType: "shop.brand",
      entityId: discount.brand,
      metadata: { discountPct: discount.discountPct },
    });
    return NextResponse.json({ discount });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const brand = request.nextUrl.searchParams.get("brand")?.trim() ?? "";
    if (!brand) return NextResponse.json({ error: "Не вказано бренд" }, { status: 400 });
    await deleteSystemBrandDiscount(prisma, brand);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "b2b.brand_discount.delete",
      entityType: "shop.brand",
      entityId: brand,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown) {
  return shopB2bAdminErrorResponse(error, "Admin B2B brand discounts");
}

export const runtime = "nodejs";
