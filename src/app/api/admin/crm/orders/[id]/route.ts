import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/crm/orders/[id]
 * Get CRM order detail with items
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
  const { id } = await params;

  try {
    // Try by local ID first, then by airtableId
    let order = await prisma.crmOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, airtableId: true } },
        items: { orderBy: { positionNumber: "asc" } },
      },
    });

    if (!order) {
      order = await prisma.crmOrder.findUnique({
        where: { airtableId: id },
        include: {
          customer: { select: { id: true, name: true, airtableId: true } },
          items: { orderBy: { positionNumber: "asc" } },
        },
      });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
