import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import {
  catalogBrochureContentDisposition,
  validateCatalogBrochureRequest,
  type CatalogBrochureRequest,
} from "@/lib/admin/catalogBrochure";
import {
  resolveCatalogBrochureSnapshot,
  snapshotToPdfInput,
} from "@/lib/admin/catalogBrochureSnapshot";

export async function POST(request: NextRequest) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const body = (await request.json()) as unknown;
    const error = validateCatalogBrochureRequest(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const input = body as CatalogBrochureRequest;
    const snapshot = await resolveCatalogBrochureSnapshot(input);
    const { renderCatalogBrochurePdf } = await import("@/lib/admin/catalogBrochurePdf");
    const pdf = await renderCatalogBrochurePdf(snapshotToPdfInput(snapshot));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": catalogBrochureContentDisposition(input.title),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (message === "CATALOG_PRODUCTS_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Один або кілька товарів більше недоступні." },
        { status: 409 }
      );
    }
    if (message === "CATALOG_BRAND_LOGO_MISSING") {
      return NextResponse.json(
        { error: "Для вибраного бренду не знайдено логотип у медіа-каталозі." },
        { status: 409 }
      );
    }
    console.error("Admin catalog PDF render failed", error);
    return NextResponse.json({ error: "Не вдалося сформувати PDF каталогу." }, { status: 500 });
  }
}
