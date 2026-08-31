import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { buildStorefrontBackfillPlan } from "@/lib/shopProductStorefront";
import { prisma } from "@/lib/prisma";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductMutation,
  type ShopCatalogCoordinatedMutationResult,
} from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const products = await prisma.shopProduct.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        slug: true,
        brand: true,
        vendor: true,
        tags: true,
        catalogVersion: true,
        collections: {
          select: {
            collection: {
              select: {
                handle: true,
                brand: true,
                isUrban: true,
                titleEn: true,
                titleUa: true,
              },
            },
          },
        },
      },
    });

    const plan = buildStorefrontBackfillPlan(
      products.map((product) => ({
        id: product.id,
        slug: product.slug,
        brand: product.brand,
        vendor: product.vendor,
        tags: product.tags,
        collections: product.collections.map((entry) => ({
          handle: entry.collection.handle,
          brand: entry.collection.brand,
          isUrban: entry.collection.isUrban,
          title: {
            en: entry.collection.titleEn,
            ua: entry.collection.titleUa,
          },
        })),
      }))
    );

    const changedItems = plan.items.filter((item) => item.changed);

    const versionById = new Map(products.map((product) => [product.id, product.catalogVersion]));
    const catalogMutations: ShopCatalogCoordinatedMutationResult[] = [];
    for (const item of changedItems) {
      const catalogVersion = versionById.get(item.id);
      if (catalogVersion === undefined) throw new Error(`Missing catalog version for ${item.id}`);
      catalogMutations.push(
        await coordinateShopCatalogProductMutation({
          productId: item.id,
          expectedCatalogVersion: catalogVersion.toString(),
          changeDomains: ["TAXONOMY", "VISIBILITY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({
              where: { id: item.id },
              data: { tags: item.tags },
            });
            await writeAdminAuditLog(tx, session, {
              scope: "shop",
              action: "product.storefront-backfill",
              entityType: "shop.product",
              entityId: item.id,
              metadata: { tags: item.tags, catalogVersion: nextCatalogVersion },
            });
            return buildShopCatalogAdminSnapshot(tx, item.id, nextCatalogVersion, {
              type: "ADMIN",
              id: session.email,
              reason: "product.storefront-backfill",
            });
          },
        })
      );
    }

    await writeAdminAuditLog(prisma, session, {
        scope: "shop",
        action: "product.storefront-backfill",
        entityType: "shop.product",
        metadata: {
          totalCount: products.length,
          updatedCount: plan.updatedCount,
          storefrontCounts: plan.storefrontCounts,
        },
    });

    if (catalogMutations.length) {
      after(async () => {
        try {
          await runShopCatalogOutboxRuntime({
            workerId: `catalog-storefront-backfill:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
            limit: Math.min(50, Math.max(10, catalogMutations.length)),
          });
        } catch (error) {
          console.error(
            "[shop-catalog.storefront-backfill] immediate publish failed; cron recovery remains active",
            { outboxIds: catalogMutations.map((mutation) => mutation.outboxId), error }
          );
        }
      });
    }

    return NextResponse.json({
      success: true,
      totalCount: products.length,
      updatedCount: plan.updatedCount,
      storefrontCounts: plan.storefrontCounts,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Storefront backfill error:", error);
    return NextResponse.json({ error: "Failed to normalize storefront tags" }, { status: 500 });
  }
}
