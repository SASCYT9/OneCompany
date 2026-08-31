import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import { applyAdminInventoryPatchInTransaction } from "../../../src/lib/shopAdminVariants";

test("inventory helper updates variants, warehouse levels, and product stock in one caller transaction", async () => {
  const quantities = new Map([
    ["variant-a", 2],
    ["variant-b", 0],
  ]);
  const levels = new Map<string, number>([["variant-a", 4]]);
  let productStock: string | null = null;
  const tx = {
    shopProductVariant: {
      findMany: async () => [...quantities].map(([id, inventoryQty]) => ({ id, inventoryQty })),
      update: async ({ where, data }: any) => {
        quantities.set(where.id, data.inventoryQty);
        return { id: where.id };
      },
      findFirst: async () =>
        [...quantities].some(([, quantity]) => quantity > 0) ? { id: "positive" } : null,
    },
    shopInventoryLevel: {
      findMany: async () =>
        [...levels].map(([variantId, stockedQuantity]) => ({ variantId, stockedQuantity })),
      upsert: async ({ where, create, update }: any) => {
        levels.set(where.variantId_locationId.variantId, update.stockedQuantity);
        return create;
      },
    },
    shopProduct: {
      update: async ({ data }: any) => {
        productStock = data.stock;
        return { id: "product-1" };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const result = await applyAdminInventoryPatchInTransaction(tx, {
    productId: "product-1",
    variantIds: ["variant-a", "variant-b"],
    inventoryAdjustment: 3,
    locationId: "warehouse-1",
  });

  assert.deepEqual(result, { updatedCount: 2, productIds: ["product-1"] });
  assert.deepEqual(Object.fromEntries(quantities), { "variant-a": 5, "variant-b": 3 });
  assert.deepEqual(Object.fromEntries(levels), { "variant-a": 7, "variant-b": 3 });
  assert.equal(productStock, "inStock");
  assert.equal("$transaction" in (tx as object), false);
});

test("inventory helper rejects variants outside the locked product", async () => {
  const tx = {
    shopProductVariant: {
      findMany: async () => [{ id: "variant-a", inventoryQty: 1 }],
    },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    applyAdminInventoryPatchInTransaction(tx, {
      productId: "product-1",
      variantIds: ["variant-a", "variant-foreign"],
      inventoryQty: 0,
    }),
    /do not all belong/
  );
});
