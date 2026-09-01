import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { assertAdminRequest } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { readShopCatalogOperationalReadinessWithClient } from "@/lib/shopCatalogOperationalReadiness.server";

export async function GET() {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
    const report = await readShopCatalogOperationalReadinessWithClient(prisma, { deploymentCommit });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((error as Error).message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Catalog V2 readiness read failed", error);
    return NextResponse.json({ error: "Failed to load Catalog V2 readiness" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
