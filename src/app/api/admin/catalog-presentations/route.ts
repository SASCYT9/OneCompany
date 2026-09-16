import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { resolveCatalogBrochureSnapshot } from "@/lib/admin/catalogBrochureSnapshot";
import {
  createCatalogShareToken,
  hashCatalogShareToken,
} from "@/lib/admin/catalogPresentationShare";
import {
  validateCatalogBrochureRequest,
  type CatalogBrochureRequest,
} from "@/lib/admin/catalogBrochure";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await assertAdminRequest(
      await cookies(),
      ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE
    );
    const body = (await request.json()) as unknown;
    const error = validateCatalogBrochureRequest(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const input = body as CatalogBrochureRequest;
    const snapshot = await resolveCatalogBrochureSnapshot(input);
    const token = createCatalogShareToken();
    const actor = await prisma.adminUser.findUnique({
      where: { email: session.email },
      select: { id: true },
    });
    const expiresAt = input.validUntil ? new Date(`${input.validUntil}T23:59:59.999Z`) : null;
    await prisma.catalogPresentationShare.create({
      data: {
        tokenHash: hashCatalogShareToken(token),
        title: snapshot.title,
        language: snapshot.language,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        expiresAt,
        createdById: actor?.id ?? null,
      },
    });

    return NextResponse.json({
      url: `${request.nextUrl.origin}/catalog/p/${token}`,
      expiresAt: expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (message === "CATALOG_PRODUCTS_UNAVAILABLE") {
      return NextResponse.json({ error: "Один або кілька товарів недоступні." }, { status: 409 });
    }
    if (message === "CATALOG_BRAND_LOGO_MISSING") {
      return NextResponse.json({ error: "Не знайдено логотип вибраного бренду." }, { status: 409 });
    }
    console.error("Catalog presentation publish failed", error);
    return NextResponse.json({ error: "Не вдалося опублікувати презентацію." }, { status: 500 });
  }
}
