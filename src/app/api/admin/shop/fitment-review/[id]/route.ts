import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  normalizeManualFitment,
} from "@/lib/shopFitmentQuality";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const { id } = await params;
    const body = await request.json();
    const normalized = normalizeManualFitment(body, session.email);
    if (!normalized.data) {
      return NextResponse.json({ error: normalized.errors.join(", ") }, { status: 400 });
    }
    const fitment = normalized.data;

    const product = await prisma.shopProduct.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.shopProductMetafield.upsert({
        where: {
          productId_namespace_key: {
            productId: id,
            namespace: NORMALIZED_FITMENT_NAMESPACE,
            key: NORMALIZED_FITMENT_KEY,
          },
        },
        create: {
          productId: id,
          namespace: NORMALIZED_FITMENT_NAMESPACE,
          key: NORMALIZED_FITMENT_KEY,
          value: JSON.stringify(fitment),
          valueType: "json",
        },
        update: {
          value: JSON.stringify(fitment),
          valueType: "json",
        },
      });
      await writeAdminAuditLog(tx, session, {
        scope: "shop",
        action: "product.fitment.review",
        entityType: "shop.product",
        entityId: id,
        metadata: {
          slug: product.slug,
          status: fitment.status,
          vehicleType: fitment.vehicleType,
          make: fitment.make,
          models: fitment.models,
          chassisCodes: fitment.chassisCodes,
          yearRanges: fitment.yearRanges,
          applications: fitment.applications,
        },
      });
    });

    return NextResponse.json({ fitment });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin fitment review update failed", error);
    return NextResponse.json({ error: "Failed to update fitment review" }, { status: 500 });
  }
}
