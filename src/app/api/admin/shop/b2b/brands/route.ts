import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { listShopB2bBrands } from "@/lib/shopB2bAdmin.server";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/shop/b2b/brands — storefront brands a B2B discount can target. */
export async function GET() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    return NextResponse.json({ brands: await listShopB2bBrands(prisma) });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin B2B brands", error);
    return NextResponse.json({ error: "Не вдалося завантажити бренди" }, { status: 500 });
  }
}

export const runtime = "nodejs";
