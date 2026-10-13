import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { assignShopCustomerTariffGroup } from "@/lib/shopB2bAdmin.server";
import { shopB2bAdminErrorResponse } from "@/lib/shopB2bAdminErrors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/shop/customers/[id]/tariff-group  { tariffGroupId: string | null }
 *
 * Puts a partner into a tariff group, moves them to another one, or (null)
 * takes them out of any group.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE
    );
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { tariffGroupId?: unknown };
    const groupId =
      typeof body.tariffGroupId === "string" && body.tariffGroupId.trim()
        ? body.tariffGroupId.trim()
        : null;
    const { previous, next } = await assignShopCustomerTariffGroup(prisma, id, groupId);
    if (previous?.id !== next?.id) {
      await writeAdminAuditLog(prisma, session, {
        scope: "shop",
        action: "customer.tariff_group.assign",
        entityType: "shop.customer",
        entityId: id,
        metadata: {
          groupId: next?.id ?? null,
          groupName: next?.name ?? null,
          previousGroupName: previous?.name ?? null,
        },
      });
    }
    return NextResponse.json({ tariffGroup: next });
  } catch (error) {
    return shopB2bAdminErrorResponse(error, "Admin customer tariff group");
  }
}

export const runtime = "nodejs";
