import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { assertAdminRequest } from "@/lib/adminAuth";

export async function POST() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    return NextResponse.json(
      {
        error: "Airtable writes are disabled. Use read-only Airtable sync into the local database.",
      },
      { status: 410 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to authorize request" }, { status: 500 });
  }
}
