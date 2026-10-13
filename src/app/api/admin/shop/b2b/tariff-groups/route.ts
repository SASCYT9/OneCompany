/**
 * GET / POST /api/admin/shop/b2b/tariff-groups
 *
 * B2B tariff groups (Silver / Gold / Dealer…): named packages of brand
 * discounts that partners are assigned to.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { createShopB2bTariffGroup, listShopB2bTariffGroups } from "@/lib/shopB2bAdmin.server";
import { shopB2bAdminErrorResponse } from "@/lib/shopB2bAdminErrors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    return NextResponse.json(
      { groups: await listShopB2bTariffGroups(prisma) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return shopB2bAdminErrorResponse(error, "Admin B2B tariff groups", "Не вдалося завантажити");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const group = await createShopB2bTariffGroup(prisma, body);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "b2b.tariff_group.create",
      entityType: "shop.b2b_tariff_group",
      entityId: group.id,
      metadata: { name: group.name },
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return shopB2bAdminErrorResponse(error, "Admin B2B tariff group create");
  }
}

export const runtime = "nodejs";
