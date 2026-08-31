import "server-only";

import type { Prisma } from "@prisma/client";

import type { AdminSession } from "./adminAuth";
import { buildShopCatalogAdminSnapshot } from "./shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductCreation,
  coordinateShopCatalogProductMutation,
} from "./shopCatalogMutationCoordinator.server";

const FULL_IMPORT_DOMAINS = [
  "CONTENT",
  "SEO",
  "MEDIA",
  "PRICE",
  "INVENTORY",
  "FITMENT",
  "TAXONOMY",
  "VISIBILITY",
] as const;

export async function publishShopCatalogImportUpdate(input: {
  productId: string;
  expectedCatalogVersion: bigint | string;
  updateData: Prisma.ShopProductUpdateInput;
  session: AdminSession;
  reason: string;
}) {
  return coordinateShopCatalogProductMutation({
    productId: input.productId,
    expectedCatalogVersion: input.expectedCatalogVersion.toString(),
    changeDomains: FULL_IMPORT_DOMAINS,
    async mutateAndSnapshot(tx, nextCatalogVersion) {
      await tx.shopProduct.update({ where: { id: input.productId }, data: input.updateData });
      return buildShopCatalogAdminSnapshot(tx, input.productId, nextCatalogVersion, {
        type: "IMPORT",
        id: input.session.email,
        reason: input.reason,
      });
    },
  });
}

export async function publishShopCatalogImportCreation(input: {
  createData: Prisma.ShopProductCreateInput;
  session: AdminSession;
  reason: string;
}) {
  return coordinateShopCatalogProductCreation({
    changeDomains: FULL_IMPORT_DOMAINS,
    async create(tx) {
      const created = await tx.shopProduct.create({ data: input.createData, select: { id: true } });
      return created.id;
    },
    snapshot(tx, productId, initialCatalogVersion) {
      return buildShopCatalogAdminSnapshot(tx, productId, initialCatalogVersion, {
        type: "IMPORT",
        id: input.session.email,
        reason: input.reason,
      });
    },
  });
}
