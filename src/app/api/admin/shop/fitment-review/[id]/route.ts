import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { after, NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  normalizeManualFitment,
} from "@/lib/shopFitmentQuality";
import { prisma } from "@/lib/prisma";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutation } from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

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
      select: { id: true, slug: true, catalogVersion: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const mutation = await coordinateShopCatalogProductMutation({
      productId: id,
      expectedCatalogVersion: product.catalogVersion.toString(),
      changeDomains: ["FITMENT"],
      async mutateAndSnapshot(tx, nextCatalogVersion) {
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
            catalogVersion: nextCatalogVersion,
          },
        });
        return buildShopCatalogAdminSnapshot(tx, id, nextCatalogVersion, {
          type: "ADMIN",
          id: session.email,
          reason: "product.fitment.review",
        });
      },
    });
    after(async () => {
      try {
        await runShopCatalogOutboxRuntime({
          workerId: `catalog-fitment-review:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          limit: 10,
        });
      } catch (error) {
        console.error("[shop-catalog.fitment-review] immediate publish failed; cron recovery remains active", {
          outboxId: mutation.outboxId,
          error,
        });
      }
    });

    return NextResponse.json({
      fitment,
      catalogVersion: mutation.canonicalVersion,
      outboxId: mutation.outboxId,
    });
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
