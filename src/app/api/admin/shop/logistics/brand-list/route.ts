import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { prisma } from "@/lib/prisma";
import { listShopBrands } from "@/lib/shopBrandDirectory.server";

/** GET /api/admin/shop/logistics/brand-list — product brands for logistics rules. */
export async function GET() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to authorize request" }, { status: 500 });
  }

  const brands = await listShopBrands(prisma);
  return NextResponse.json({ success: true, brands });
}
