import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { assertAdminRequest } from "@/lib/adminAuth";
import { createStockFeedResponse } from "@/lib/shopStockFeed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_INVENTORY_READ);
    return await createStockFeedResponse(req.nextUrl.searchParams);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Stock Feed Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate stock feed from Airtable", details: error?.message },
      { status: 500 }
    );
  }
}
