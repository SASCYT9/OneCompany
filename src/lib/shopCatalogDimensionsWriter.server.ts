import "server-only";

import type { Prisma } from "@prisma/client";

import type { AdminSession } from "./adminAuth";
import { writeAdminAuditLog } from "./adminRbac";
import { buildShopCatalogAdminSnapshot } from "./shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductMutation,
  type ShopCatalogCoordinatedMutationResult,
} from "./shopCatalogMutationCoordinator.server";

export type ShopCatalogVariantDimensionsPatch = {
  variantId: string;
  data: Prisma.ShopProductVariantUpdateInput;
};

export async function publishShopCatalogDimensionsUpdate(input: {
  productId: string;
  expectedCatalogVersion?: bigint | string;
  patches: readonly ShopCatalogVariantDimensionsPatch[];
  session: AdminSession;
  reason: string;
}): Promise<ShopCatalogCoordinatedMutationResult> {
  if (!input.patches.length) throw new TypeError("At least one dimensions patch is required");
  const variantIds = input.patches.map((patch) => patch.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new TypeError("A variant may only be patched once per product mutation");
  }

  return coordinateShopCatalogProductMutation({
    productId: input.productId,
    expectedCatalogVersion: input.expectedCatalogVersion?.toString(),
    changeDomains: ["CONTENT"],
    async mutateAndSnapshot(tx, nextCatalogVersion) {
      const owned = await tx.shopProductVariant.count({
        where: { productId: input.productId, id: { in: variantIds } },
      });
      if (owned !== variantIds.length) {
        throw new Error("One or more dimensions variants do not belong to the locked product");
      }
      for (const patch of input.patches) {
        await tx.shopProductVariant.update({ where: { id: patch.variantId }, data: patch.data });
      }
      await writeAdminAuditLog(tx, input.session, {
        scope: "shop",
        action: input.reason,
        entityType: "shop.product",
        entityId: input.productId,
        metadata: { variantIds, catalogVersion: nextCatalogVersion },
      });
      return buildShopCatalogAdminSnapshot(tx, input.productId, nextCatalogVersion, {
        type: "ADMIN",
        id: input.session.email,
        reason: input.reason,
      });
    },
  });
}
