import assert from "node:assert/strict";
import test from "node:test";

import { EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG, EVENTURI_WAREHOUSE_EDITORIAL_SLUGS } from "../../../src/lib/eventuriWarehouseEditorialCopy";
import { SHOP_WAREHOUSE_IN_STOCK_EVENTURI_SKUS } from "../../../src/lib/shopWarehouseInventory";

test("warehouse editorial map covers 15 distinct product records", () => {
  assert.equal(EVENTURI_WAREHOUSE_EDITORIAL_SLUGS.length, 15);
  assert.equal(new Set(EVENTURI_WAREHOUSE_EDITORIAL_SLUGS).size, 15);
});

test("warehouse editorial records preserve all 11 approved stock SKUs", () => {
  const mappedSkus = new Set(Object.values(EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG).map((entry) => entry.sku));
  assert.deepEqual([...mappedSkus].sort(), [...SHOP_WAREHOUSE_IN_STOCK_EVENTURI_SKUS].sort());
});

test("shared SKUs keep model-specific storefront titles", () => {
  const shared = Object.values(EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG).filter((entry) => entry.sku === "EVE-4V8TT-CF-INT");
  assert.equal(shared.length, 4);
  assert.equal(new Set(shared.map((entry) => entry.titleUa)).size, 4);
  assert.ok(shared.some((entry) => entry.titleUa.includes("RSQ8")));
});
