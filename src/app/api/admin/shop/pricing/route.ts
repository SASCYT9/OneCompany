import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  adminVariantSummarySelect,
  applyAdminPricingPatchInTransaction,
  serializeAdminVariantSummary,
} from "@/lib/shopAdminVariants";
import { prisma } from "@/lib/prisma";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductMutation,
  type ShopCatalogCoordinatedMutationResult,
} from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

function decimalOrNull(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_READ);

    const variants = await prisma.shopProductVariant.findMany({
      orderBy: [{ productId: "asc" }, { position: "asc" }],
      select: adminVariantSummarySelect,
    });

    return NextResponse.json(variants.map(serializeAdminVariantSummary));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin pricing list", error);
    return NextResponse.json({ error: "Failed to list pricing" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_WRITE);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const variantIds = Array.isArray(body.variantIds)
      ? body.variantIds.map((entry) => String(entry))
      : [];

    const payload = {
      variantIds,
      priceEur: Object.prototype.hasOwnProperty.call(body, "priceEur")
        ? decimalOrNull(body.priceEur)
        : undefined,
      priceEurEurope: Object.prototype.hasOwnProperty.call(body, "priceEurEurope")
        ? decimalOrNull(body.priceEurEurope)
        : undefined,
      priceUsd: Object.prototype.hasOwnProperty.call(body, "priceUsd")
        ? decimalOrNull(body.priceUsd)
        : undefined,
      priceUah: Object.prototype.hasOwnProperty.call(body, "priceUah")
        ? decimalOrNull(body.priceUah)
        : undefined,
      priceEurB2b: Object.prototype.hasOwnProperty.call(body, "priceEurB2b")
        ? decimalOrNull(body.priceEurB2b)
        : undefined,
      priceUsdB2b: Object.prototype.hasOwnProperty.call(body, "priceUsdB2b")
        ? decimalOrNull(body.priceUsdB2b)
        : undefined,
      priceUahB2b: Object.prototype.hasOwnProperty.call(body, "priceUahB2b")
        ? decimalOrNull(body.priceUahB2b)
        : undefined,
      compareAtEur: Object.prototype.hasOwnProperty.call(body, "compareAtEur")
        ? decimalOrNull(body.compareAtEur)
        : undefined,
      compareAtUsd: Object.prototype.hasOwnProperty.call(body, "compareAtUsd")
        ? decimalOrNull(body.compareAtUsd)
        : undefined,
      compareAtUah: Object.prototype.hasOwnProperty.call(body, "compareAtUah")
        ? decimalOrNull(body.compareAtUah)
        : undefined,
      compareAtEurB2b: Object.prototype.hasOwnProperty.call(body, "compareAtEurB2b")
        ? decimalOrNull(body.compareAtEurB2b)
        : undefined,
      compareAtUsdB2b: Object.prototype.hasOwnProperty.call(body, "compareAtUsdB2b")
        ? decimalOrNull(body.compareAtUsdB2b)
        : undefined,
      compareAtUahB2b: Object.prototype.hasOwnProperty.call(body, "compareAtUahB2b")
        ? decimalOrNull(body.compareAtUahB2b)
        : undefined,
      multiplyUah: Object.prototype.hasOwnProperty.call(body, "multiplyUah")
        ? decimalOrNull(body.multiplyUah)
        : undefined,
      multiplyEur: Object.prototype.hasOwnProperty.call(body, "multiplyEur")
        ? decimalOrNull(body.multiplyEur)
        : undefined,
      multiplyEurEurope: Object.prototype.hasOwnProperty.call(body, "multiplyEurEurope")
        ? decimalOrNull(body.multiplyEurEurope)
        : undefined,
      multiplyUsd: Object.prototype.hasOwnProperty.call(body, "multiplyUsd")
        ? decimalOrNull(body.multiplyUsd)
        : undefined,
      multiplyEurB2b: Object.prototype.hasOwnProperty.call(body, "multiplyEurB2b")
        ? decimalOrNull(body.multiplyEurB2b)
        : undefined,
      multiplyUsdB2b: Object.prototype.hasOwnProperty.call(body, "multiplyUsdB2b")
        ? decimalOrNull(body.multiplyUsdB2b)
        : undefined,
      multiplyUahB2b: Object.prototype.hasOwnProperty.call(body, "multiplyUahB2b")
        ? decimalOrNull(body.multiplyUahB2b)
        : undefined,
    };

    if (!variantIds.length) {
      return NextResponse.json({ error: "variantIds are required" }, { status: 400 });
    }

    const hasUpdate = Object.entries(payload)
      .filter(([key]) => key !== "variantIds")
      .some(([, value]) => value !== undefined);

    if (!hasUpdate) {
      return NextResponse.json({ error: "No pricing changes provided" }, { status: 400 });
    }

    const uniqueVariantIds = [...new Set(variantIds)];
    const selectedVariants = await prisma.shopProductVariant.findMany({
      where: { id: { in: uniqueVariantIds } },
      select: {
        id: true,
        productId: true,
        product: { select: { catalogVersion: true } },
      },
    });
    if (selectedVariants.length !== uniqueVariantIds.length) {
      return NextResponse.json({ error: "One or more variants were not found" }, { status: 404 });
    }
    const groups = new Map<string, { catalogVersion: string; variantIds: string[] }>();
    for (const variant of selectedVariants) {
      const group = groups.get(variant.productId) ?? {
        catalogVersion: variant.product.catalogVersion.toString(),
        variantIds: [],
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
        changeDomains: ["PRICE"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          const result = await applyAdminPricingPatchInTransaction(tx, {
            ...payload,
            productId,
            variantIds: group.variantIds,
          });
          affectedCount = result.updatedCount;
          await writeAdminAuditLog(tx, session, {
            scope: "shop",
            action: "pricing.patch",
            entityType: "shop.product",
            entityId: productId,
            metadata: {
              ...payload,
              variantIds: group.variantIds,
              affectedCount,
              catalogVersion: nextCatalogVersion,
            },
          });
          return buildShopCatalogAdminSnapshot(tx, productId, nextCatalogVersion, {
            type: "ADMIN",
            id: session.email,
            reason: "pricing.patch",
          });
        },
      });
      updatedCount += affectedCount;
      catalogMutations.push(mutation);
    }

    after(async () => {
      try {
        await runShopCatalogOutboxRuntime({
          workerId: `catalog-pricing:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          limit: Math.min(50, Math.max(10, catalogMutations.length)),
        });
      } catch (error) {
        console.error("[shop-catalog.pricing] immediate publish failed; cron recovery remains active", {
          outboxIds: catalogMutations.map((mutation) => mutation.outboxId),
          error,
        });
      }
    });

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
        { error: "Pricing changed concurrently. Reload it before saving again." },
        { status: 409 }
      );
    }
    console.error("Admin pricing patch", error);
    return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
  }
}
