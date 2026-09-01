import type { PrismaClient } from "@prisma/client";

import type { AdminSession } from "@/lib/adminAuth";
import { writeAdminAuditLog } from "@/lib/adminRbac";
import type { AirtableProductStock } from "@/lib/airtable";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductMutationWithClient,
  type ShopCatalogCoordinatedMutationResult,
} from "@/lib/shopCatalogMutationCoordinator.server";

export async function syncAirtableStocksToCatalog(input: {
  prisma: PrismaClient;
  items: readonly AirtableProductStock[];
  session: AdminSession;
}) {
  const quantityBySku = new Map<string, number>();
  for (const item of input.items) {
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
    ? await input.prisma.shopProductVariant.findMany({
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

  const mutations: ShopCatalogCoordinatedMutationResult[] = [];
  for (const [productId, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  )) {
    mutations.push(
      await coordinateShopCatalogProductMutationWithClient(input.prisma, {
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
          await writeAdminAuditLog(tx, input.session, {
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
            id: input.session.email,
            reason: "airtable.stock.sync",
          });
        },
      }),
    );
  }

  const matchedSkus = new Set(variants.flatMap((variant) => (variant.sku ? [variant.sku] : [])));
  return {
    scanned: input.items.length,
    updated: [...groups.values()].reduce((sum, group) => sum + group.variants.length, 0),
    productsUpdated: mutations.length,
    unmatchedSkus: [...quantityBySku.keys()].filter((sku) => !matchedSkus.has(sku)).length,
    mutations,
  };
}
