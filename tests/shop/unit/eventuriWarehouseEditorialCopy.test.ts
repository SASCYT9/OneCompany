import assert from "node:assert/strict";
import test from "node:test";

import { EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG, EVENTURI_WAREHOUSE_EDITORIAL_SLUGS } from "../../../src/lib/eventuriWarehouseEditorialCopy";
import { SHOP_WAREHOUSE_IN_STOCK_EVENTURI_SKUS } from "../../../src/lib/shopWarehouseInventory";

test("warehouse editorial map covers 12 canonical product records", () => {
  assert.equal(EVENTURI_WAREHOUSE_EDITORIAL_SLUGS.length, 12);
  assert.equal(new Set(EVENTURI_WAREHOUSE_EDITORIAL_SLUGS).size, 12);
});

test("warehouse editorial records preserve all 11 approved stock SKUs", () => {
  const mappedSkus = new Set(Object.values(EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG).map((entry) => entry.sku));
  assert.deepEqual([...mappedSkus].sort(), [...SHOP_WAREHOUSE_IN_STOCK_EVENTURI_SKUS].sort());
});

test("shared V8 intake is one canonical storefront product with every application", () => {
  const shared = Object.values(EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG).filter((entry) => entry.sku === "EVE-4V8TT-CF-INT");
  assert.equal(shared.length, 1);
  for (const application of ["Audi", "Lamborghini", "Porsche", "Bentley"]) {
    assert.ok(shared[0].titleUa.includes(application));
    assert.ok(shared[0].longDescUa.includes(application));
  }
});
