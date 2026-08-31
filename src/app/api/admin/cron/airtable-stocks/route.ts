import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { fetchAirtableProductsWithStocks } from "@/lib/airtable";
import { prisma } from "@/lib/prisma";
import { matchesBearerSecret, resolveSecret } from "@/lib/requestSecrets";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductMutation,
  type ShopCatalogCoordinatedMutationResult,
} from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import { writeAdminAuditLog } from "@/lib/adminRbac";

const AIRTABLE_STOCK_SESSION = {
  email: "airtable-stock-cron@system.local",
  name: "Airtable stock cron",
  permissions: ["*"],
  issuedAt: 0,
  nonce: "airtable-stock-cron",
};

export async function GET(req: Request) {
  const cronSecret = resolveSecret("CRON_SECRET");

  if (!matchesBearerSecret(req.headers, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Airtable Sync] Starting stock sync...");
    const airtableProducts = await fetchAirtableProductsWithStocks();
    console.log(`[Airtable Sync] Fetched ${airtableProducts.length} items from Airtable`);

    const quantityBySku = new Map<string, number>();
    for (const item of airtableProducts) {
      const sku = item.sku?.trim();
      if (!sku) continue;
      if (!Number.isSafeInteger(item.quantity)) {
        throw new Error(`Invalid Airtable inventory quantity for SKU ${sku}`);
      }
      const existing = quantityBySku.get(sku);
      if (existing !== undefined && existing !== item.quantity) {
        throw new Error(`Conflicting Airtable inventory quantities for SKU ${sku}`);
      }
      quantityBySku.set(sku, item.quantity);
    }

    const variants = quantityBySku.size
      ? await prisma.shopProductVariant.findMany({
          where: { sku: { in: [...quantityBySku.keys()] } },
          select: {
            id: true,
            sku: true,
            productId: true,
            product: { select: { catalogVersion: true } },
          },
        })
      : [];
    const groups = new Map<
      string,
      { catalogVersion: bigint; variants: Array<{ id: string; quantity: number }> }
    >();
    for (const variant of variants) {
      if (!variant.sku) continue;
      const quantity = quantityBySku.get(variant.sku);
      if (quantity === undefined) continue;
      const group = groups.get(variant.productId) ?? {
        catalogVersion: variant.product.catalogVersion,
        variants: [],
      };
      group.variants.push({ id: variant.id, quantity });
      groups.set(variant.productId, group);
    }

    let updatedCount = 0;
    const catalogMutations: ShopCatalogCoordinatedMutationResult[] = [];
    for (const [productId, group] of [...groups.entries()].sort(([a], [b]) =>
      a.localeCompare(b, "en")
    )) {
      const mutation = await coordinateShopCatalogProductMutation({
        productId,
        expectedCatalogVersion: group.catalogVersion.toString(),
        changeDomains: ["INVENTORY"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          for (const variant of group.variants) {
            await tx.shopProductVariant.update({
              where: { id: variant.id },
              data: { inventoryQty: variant.quantity },
            });
          }
          await writeAdminAuditLog(tx, AIRTABLE_STOCK_SESSION, {
            scope: "shop",
            action: "airtable.stock.sync",
            entityType: "shop.product",
            entityId: productId,
            metadata: {
              variantIds: group.variants.map((variant) => variant.id),
              catalogVersion: nextCatalogVersion,
            },
          });
          return buildShopCatalogAdminSnapshot(tx, productId, nextCatalogVersion, {
            type: "IMPORT",
            id: AIRTABLE_STOCK_SESSION.email,
            reason: "airtable.stock.sync",
          });
        },
      });
      updatedCount += group.variants.length;
      catalogMutations.push(mutation);
    }

    if (catalogMutations.length) {
      after(async () => {
        try {
          await runShopCatalogOutboxRuntime({
            workerId: `catalog-airtable-stock:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
            limit: Math.min(50, Math.max(10, catalogMutations.length)),
          });
        } catch (error) {
          console.error("[shop-catalog.airtable-stock] immediate publish failed; cron recovery remains active", {
            outboxIds: catalogMutations.map((mutation) => mutation.outboxId),
            error,
          });
        }
      });
    }

    console.log(`[Airtable Sync] Successfully updated ${updatedCount} variants from Airtable`);

    return NextResponse.json({
      success: true,
      scanned: airtableProducts.length,
      updated: updatedCount,
      productsUpdated: catalogMutations.length,
      unmatchedSkus: quantityBySku.size - new Set(variants.map((variant) => variant.sku)).size,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Airtable Sync] Error syncing stocks:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
