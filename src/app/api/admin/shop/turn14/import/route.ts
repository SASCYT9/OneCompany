import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { prisma } from "@/lib/prisma";
import { importTurn14ItemToDb } from "@/lib/turn14Sync";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    const itemData = await request.json();

    if (!itemData) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const result = await importTurn14ItemToDb(prisma, itemData);

    return NextResponse.json({
      success: true,
      product: {
        id: result.id,
        slug: result.slug,
        action: result.action,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Turn14 Import DB Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import Turn14 item" },
      { status: 500 }
    );
  }
}
