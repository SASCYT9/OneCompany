import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { getOneAiQualitySnapshot } from "@/lib/admin/oneAiQualityRepository";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_AI_READ);

    return NextResponse.json(await getOneAiQualitySnapshot(prisma), {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Admin One AI quality snapshot failed", error);
    return NextResponse.json({ error: "Failed to load One AI quality data" }, { status: 500 });
  }
}
