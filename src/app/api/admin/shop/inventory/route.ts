import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { ShopInventoryPolicy } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  adminVariantSummarySelect,
  applyAdminInventoryPatchInTransaction,
  serializeAdminVariantSummary,
} from "@/lib/shopAdminVariants";
import { prisma } from "@/lib/prisma";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductMutation,
  type ShopCatalogCoordinatedMutationResult,
} from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import { revalidateShopStorefrontProductDetail } from "@/lib/shopStorefrontRevalidation";

function numberOrNull(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_INVENTORY_READ);

    const variants = await prisma.shopProductVariant.findMany({
      orderBy: [{ productId: "asc" }, { position: "asc" }],
      select: adminVariantSummarySelect,
    });

    const locations = await prisma.shopWarehouse.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      variants: variants.map(serializeAdminVariantSummary),
      locations,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin inventory list", error);
    return NextResponse.json({ error: "Failed to list inventory" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_INVENTORY_WRITE);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const variantIds = Array.isArray(body.variantIds)
      ? body.variantIds.map((entry) => String(entry))
      : [];
    const inventoryQty = numberOrNull(body.inventoryQty);
    const inventoryAdjustment = numberOrNull(body.inventoryAdjustment);
    const inventoryPolicyRaw =
      body.inventoryPolicy == null ? undefined : String(body.inventoryPolicy).toUpperCase();
    const inventoryPolicy =
      inventoryPolicyRaw === "DENY" || inventoryPolicyRaw === "CONTINUE"
        ? (inventoryPolicyRaw as ShopInventoryPolicy)
        : undefined;
    const inventoryTracker = Object.prototype.hasOwnProperty.call(body, "inventoryTracker")
      ? nullableString(body.inventoryTracker)
      : undefined;
    const fulfillmentService = Object.prototype.hasOwnProperty.call(body, "fulfillmentService")
      ? nullableString(body.fulfillmentService)
      : undefined;

    const locationId = body.locationId ? String(body.locationId) : undefined;

    if (!variantIds.length) {
      return NextResponse.json({ error: "variantIds are required" }, { status: 400 });
    }
    if (inventoryQty != null && inventoryAdjustment != null) {
      return NextResponse.json(
        { error: "Use either inventoryQty or inventoryAdjustment, not both" },
        { status: 400 }
      );
    }

    const hasUpdate =
      inventoryQty != null ||
      inventoryAdjustment != null ||
      inventoryPolicy !== undefined ||
      inventoryTracker !== undefined ||
      fulfillmentService !== undefined ||
      locationId !== undefined;

    if (!hasUpdate) {
      return NextResponse.json({ error: "No inventory changes provided" }, { status: 400 });
    }

    const uniqueVariantIds = [...new Set(variantIds)];
    const selectedVariants = await prisma.shopProductVariant.findMany({
      where: { id: { in: uniqueVariantIds } },
      select: {
        id: true,
        productId: true,
        product: {
          select: { catalogVersion: true, slug: true, brand: true, vendor: true, tags: true },
        },
      },
    });
    if (selectedVariants.length !== uniqueVariantIds.length) {
      return NextResponse.json({ error: "One or more variants were not found" }, { status: 404 });
    }
    const groups = new Map<
      string,
      {
        catalogVersion: string;
        variantIds: string[];
        storefront: { slug: string; brand: string | null; vendor: string | null; tags: string[] };
      }
    >();
    for (const variant of selectedVariants) {
      const group = groups.get(variant.productId) ?? {
        catalogVersion: variant.product.catalogVersion.toString(),
        variantIds: [],
        storefront: variant.product,
      };
      group.variantIds.push(variant.id);
      groups.set(variant.productId, group);
    }

    const catalogMutations: ShopCatalogCoordinatedMutationResult[] = [];
    let updatedCount = 0;
    for (const [productId, group] of [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right, "en")
    )) {
      let affectedCount = 0;
      const mutation = await coordinateShopCatalogProductMutation({
        productId,
        expectedCatalogVersion: group.catalogVersion,
        changeDomains: ["INVENTORY"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          const result = await applyAdminInventoryPatchInTransaction(tx, {
            productId,
            variantIds: group.variantIds,
            inventoryQty,
            inventoryAdjustment,
            inventoryPolicy,
            inventoryTracker,
            fulfillmentService,
            locationId,
          });
          affectedCount = result.updatedCount;
          await writeAdminAuditLog(tx, session, {
            scope: "shop",
            action: "inventory.patch",
            entityType: "shop.product",
            entityId: productId,
            metadata: {
              variantIds: group.variantIds,
              inventoryQty,
              inventoryAdjustment,
              inventoryPolicy,
              inventoryTracker,
              fulfillmentService,
              locationId,
              affectedCount,
              catalogVersion: nextCatalogVersion,
            },
          });
          return buildShopCatalogAdminSnapshot(tx, productId, nextCatalogVersion, {
            type: "ADMIN",
            id: session.email,
            reason: "inventory.patch",
          });
        },
      });
      updatedCount += affectedCount;
      catalogMutations.push(mutation);
    }

    after(async () => {
      try {
        await runShopCatalogOutboxRuntime({
          workerId: `catalog-inventory:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          limit: Math.min(50, Math.max(10, catalogMutations.length)),
        });
      } catch (error) {
        console.error("[shop-catalog.inventory] immediate publish failed; cron recovery remains active", {
          outboxIds: catalogMutations.map((mutation) => mutation.outboxId),
          error,
        });
      }
    });

    try {
      for (const group of groups.values()) {
        revalidateShopStorefrontProductDetail(group.storefront);
      }
    } catch (error) {
      // Persistence already committed. Never report a false mutation failure;
      // the product remains protected by its normal ISR expiry.
      console.error("[shop-catalog.inventory] targeted PDP revalidation failed", { error });
    }

    return NextResponse.json({
      updatedCount,
      productIds: [...groups.keys()],
      catalog: catalogMutations.map((mutation) => ({
        productId: mutation.productId,
        version: mutation.canonicalVersion,
        revisionId: mutation.revisionId,
        outboxId: mutation.outboxId,
        status: "SAVED",
      })),
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (/^Catalog version conflict/.test((error as Error).message)) {
      return NextResponse.json(
        { error: "Inventory changed concurrently. Reload it before saving again." },
        { status: 409 }
      );
    }
    console.error("Admin inventory patch", error);
    return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 });
  }
}
