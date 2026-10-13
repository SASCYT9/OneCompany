import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { listShopB2bPartners } from "@/lib/shopB2bAdmin.server";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/shop/b2b/partners — approved partners with their brand terms. */
export async function GET() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    return NextResponse.json(
      { partners: await listShopB2bPartners(prisma) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin B2B partners", error);
    return NextResponse.json({ error: "Не вдалося завантажити партнерів" }, { status: 500 });
  }
}

export const runtime = "nodejs";
