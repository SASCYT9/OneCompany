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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const body = (await request.json()) as { productIds?: unknown; fitment?: unknown };
    const productIds = Array.from(
      new Set(
        (Array.isArray(body.productIds) ? body.productIds : [])
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      )
    );
    if (!productIds.length || productIds.length > 100) {
      return NextResponse.json({ error: "Select between 1 and 100 products" }, { status: 400 });
    }

    const normalized = normalizeManualFitment(body.fitment, session.email);
    if (!normalized.data) {
      return NextResponse.json({ error: normalized.errors.join(", ") }, { status: 400 });
    }
    const products = await prisma.shopProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products were not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const productId of productIds) {
        await tx.shopProductMetafield.upsert({
          where: {
            productId_namespace_key: {
              productId,
              namespace: NORMALIZED_FITMENT_NAMESPACE,
              key: NORMALIZED_FITMENT_KEY,
            },
          },
          create: {
            productId,
            namespace: NORMALIZED_FITMENT_NAMESPACE,
            key: NORMALIZED_FITMENT_KEY,
            value: JSON.stringify(normalized.data),
            valueType: "json",
          },
          update: {
            value: JSON.stringify(normalized.data),
            valueType: "json",
          },
        });
      }
      await writeAdminAuditLog(tx, session, {
        scope: "shop",
        action: "product.fitment.bulk-review",
        entityType: "shop.product.fitment",
        metadata: {
          productIds,
          count: productIds.length,
          fitment: normalized.data,
        },
      });
    });

    return NextResponse.json({ updated: productIds.length, fitment: normalized.data });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin bulk fitment review failed", error);
    return NextResponse.json({ error: "Failed to update fitment review" }, { status: 500 });
  }
}
