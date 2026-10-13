/**
 * PATCH / DELETE /api/admin/shop/b2b/tariff-groups/[id]
 *
 * Rename or describe a tariff group, or delete it. Deleting keeps its partners
 * as partners; they just stop getting the group's brand discounts.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { deleteShopB2bTariffGroup, updateShopB2bTariffGroup } from "@/lib/shopB2bAdmin.server";
import { shopB2bAdminErrorResponse } from "@/lib/shopB2bAdminErrors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const group = await updateShopB2bTariffGroup(prisma, id, body);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "b2b.tariff_group.update",
      entityType: "shop.b2b_tariff_group",
      entityId: id,
      metadata: { name: group.name, previousName: group.previousName },
    });
    return NextResponse.json({ group: { id: group.id, name: group.name } });
  } catch (error) {
    return shopB2bAdminErrorResponse(error, "Admin B2B tariff group update");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const { id } = await context.params;
    const removed = await deleteShopB2bTariffGroup(prisma, id);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "b2b.tariff_group.delete",
      entityType: "shop.b2b_tariff_group",
      entityId: id,
      metadata: removed,
    });
    return NextResponse.json({ ok: true, ...removed });
  } catch (error) {
    return shopB2bAdminErrorResponse(error, "Admin B2B tariff group delete", "Не вдалося видалити");
  }
}

export const runtime = "nodejs";
