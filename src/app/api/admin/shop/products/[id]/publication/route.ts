import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { getShopCatalogPublicationStatus } from "@/lib/shopCatalogPublicationStatus.server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const { id } = await context.params;
    const status = await getShopCatalogPublicationStatus({
      productId: id,
      version: request.nextUrl.searchParams.get("version"),
    });
    if (!status) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json(status, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (/^Invalid catalog version|ahead of product/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[shop-catalog.publication-status]", error);
    return NextResponse.json({ error: "Failed to read publication status" }, { status: 500 });
  }
}
