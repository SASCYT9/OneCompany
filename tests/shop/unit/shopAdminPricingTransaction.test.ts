import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import { applyAdminPricingPatchInTransaction } from "../../../src/lib/shopAdminVariants";

test("pricing helper applies regional and B2B multipliers then syncs the default variant", async () => {
  const variants = new Map<string, any>([
    [
      "default",
      {
        id: "default",
        productId: "product-1",
        isDefault: true,
        priceEur: 100,
        priceEurEurope: 110,
        priceUsd: 120,
        priceUah: 4_000,
        priceEurB2b: 80,
        priceUsdB2b: 90,
        priceUahB2b: 3_000,
        compareAtEur: null,
        compareAtUsd: null,
        compareAtUah: null,
        compareAtEurB2b: null,
        compareAtUsdB2b: null,
        compareAtUahB2b: null,
      },
    ],
  ]);
  let productPrices: Record<string, unknown> | null = null;
  const tx = {
    shopProductVariant: {
      findMany: async () => [...variants.values()],
      update: async ({ where, data }: any) => {
        const definedData = Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== undefined)
        );
        variants.set(where.id, { ...variants.get(where.id), ...definedData });
        return variants.get(where.id);
      },
      findFirst: async () => variants.get("default"),
    },
    shopProduct: {
      update: async ({ data }: any) => {
        productPrices = data;
        return { id: "product-1" };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const result = await applyAdminPricingPatchInTransaction(tx, {
    productId: "product-1",
    variantIds: ["default"],
    multiplyEur: 1.1,
    multiplyEurEurope: 1.2,
    multiplyUsd: 1.05,
    multiplyUah: 1.025,
    multiplyEurB2b: 1.1,
    multiplyUsdB2b: 1.1,
    multiplyUahB2b: 1.1,
    compareAtUah: 5_000,
  });

  assert.deepEqual(result, { updatedCount: 1, productIds: ["product-1"] });
  assert.equal(variants.get("default").priceEur, 110);
  assert.equal(variants.get("default").priceEurEurope, 132);
  assert.equal(variants.get("default").priceUsd, 126);
  assert.equal(variants.get("default").priceUah, 4_100);
  assert.equal(variants.get("default").priceEurB2b, 88);
  assert.equal(variants.get("default").priceUsdB2b, 99);
  assert.equal(variants.get("default").priceUahB2b, 3_300);
  assert.equal(variants.get("default").compareAtUah, 5_000);
  assert.deepEqual(productPrices, {
    priceEur: 110,
    priceEurEurope: 132,
    priceUsd: 126,
    priceUah: 4_100,
    priceEurB2b: 88,
    priceUsdB2b: 99,
    priceUahB2b: 3_300,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: 5_000,
    compareAtEurB2b: null,
    compareAtUsdB2b: null,
    compareAtUahB2b: null,
  });
  assert.equal("$transaction" in (tx as object), false);
});

test("pricing helper rejects variants outside the locked product", async () => {
  const tx = {
    shopProductVariant: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    applyAdminPricingPatchInTransaction(tx, {
      productId: "product-1",
      variantIds: ["foreign"],
      priceUah: 1,
    }),
    /do not all belong/
  );
});
