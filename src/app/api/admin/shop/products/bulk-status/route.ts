import { randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { parseAdminProductBulkStatusInput } from "@/lib/adminRouteValidation";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductMutation,
  type ShopCatalogCoordinatedMutationResult,
} from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const body = await request.json();
    const { ids, status, isPublished, clearPublishedAt } = parseAdminProductBulkStatusInput(body);

    const uniqueIds = [...new Set(ids)].sort((left, right) => left.localeCompare(right, "en"));
    const products = await prisma.shopProduct.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, catalogVersion: true },
    });
    if (products.length !== uniqueIds.length) {
      const foundIds = new Set(products.map((product) => product.id));
      return NextResponse.json(
        { error: "One or more products were not found", missingIds: uniqueIds.filter((id) => !foundIds.has(id)) },
        { status: 404 }
      );
    }
    const versionById = new Map(
      products.map((product) => [product.id, product.catalogVersion.toString()])
    );
    const catalogMutations: ShopCatalogCoordinatedMutationResult[] = [];
    for (const productId of uniqueIds) {
      catalogMutations.push(
        await coordinateShopCatalogProductMutation({
          productId,
          expectedCatalogVersion: versionById.get(productId),
          changeDomains: ["VISIBILITY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({
              where: { id: productId },
              data: {
                status,
                isPublished,
                publishedAt: clearPublishedAt ? null : new Date(),
              },
            });
            await writeAdminAuditLog(tx, session, {
              scope: "shop",
              action: "product.bulk-status",
              entityType: "shop.product",
              entityId: productId,
              metadata: { status, isPublished, clearPublishedAt, catalogVersion: nextCatalogVersion },
            });
            return buildShopCatalogAdminSnapshot(tx, productId, nextCatalogVersion, {
              type: "ADMIN",
              id: session.email,
              reason: "product.bulk-status",
            });
          },
        })
      );
    }

    after(async () => {
      try {
        await runShopCatalogOutboxRuntime({
          workerId: `catalog-bulk-status:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          limit: Math.min(50, Math.max(10, catalogMutations.length)),
        });
      } catch (error) {
        console.error("[shop-catalog.bulk-status] immediate publish failed; cron recovery remains active", {
          outboxIds: catalogMutations.map((mutation) => mutation.outboxId),
          error,
        });
      }
    });

    return NextResponse.json({
      success: true,
      count: catalogMutations.length,
      catalog: catalogMutations.map((mutation) => ({
        productId: mutation.productId,
        version: mutation.canonicalVersion,
        revisionId: mutation.revisionId,
        outboxId: mutation.outboxId,
        status: "SAVED",
      })),
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (/^Catalog version conflict/.test(String(error.message ?? ""))) {
      return NextResponse.json(
        { error: "One of the products changed concurrently. Reload before applying bulk status." },
        { status: 409 }
      );
    }
    if (/required|invalid/i.test(String(error.message ?? ""))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Bulk Status Error:", error);
    return NextResponse.json({ error: "Failed to update products" }, { status: 500 });
  }
}
