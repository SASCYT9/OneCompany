import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";

export const dynamic = "force-dynamic";

/**
 * The legacy endpoint applied one fitment payload to an arbitrary product list
 * without a preview token, per-product revision checks, or evidence. Keep the
 * route as an authenticated tombstone so old admin clients fail closed.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_AI_MANAGE);

    return NextResponse.json(
      {
        error: "Bulk fitment mutation is disabled",
        code: "BULK_FITMENT_DISABLED",
        replacement: "/api/admin/shop/ai-quality/bulk/preview",
      },
      {
        status: 410,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Admin bulk fitment tombstone failed", error);
    return NextResponse.json({ error: "Bulk fitment mutation is disabled" }, { status: 410 });
  }
}
