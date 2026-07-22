import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { syncAllCrmData, getCrmSyncStats, bridgeCrmItemsToShopOrders } from "@/lib/crmSync";

/**
 * GET /api/admin/crm/full-sync — Get sync stats
 * POST /api/admin/crm/full-sync — Trigger full sync
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const stats = await getCrmSyncStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const result = await syncAllCrmData();
    const bridgeResult = await bridgeCrmItemsToShopOrders();
    return NextResponse.json({ success: true, ...result, bridge: bridgeResult });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 60; // allow up to 60s for full sync
