import test from "node:test";
import assert from "node:assert/strict";

import {
  getShopWarehouseStockStatus,
  isShopWarehouseInStockSku,
  resolveShopWarehouseHeroImage,
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
} from "../../../src/lib/shopWarehouseInventory";

test("warehouse inventory contains the eleven confirmed Eventuri SKUs", () => {
  assert.equal(SHOP_WAREHOUSE_IN_STOCK_SKUS.length, 11);
  assert.equal(new Set(SHOP_WAREHOUSE_IN_STOCK_SKUS).size, 11);
  assert.equal(SHOP_WAREHOUSE_IN_STOCK_SKUS.every(isShopWarehouseInStockSku), true);
});

test("warehouse inventory matching is normalized but remains exact", () => {
  assert.equal(isShopWarehouseInStockSku(" eve-g9x-cf-int "), true);
  assert.equal(isShopWarehouseInStockSku("EVE-G9X-CF-INT-V2"), false);
  assert.equal(isShopWarehouseInStockSku("X167M-B40S-800-00"), false);
  assert.equal(getShopWarehouseStockStatus("EVE-FLC"), "inStock");
  assert.equal(getShopWarehouseStockStatus("EVE-UNKNOWN"), "preOrder");
  assert.equal(
    resolveShopWarehouseHeroImage("EVE-G9X-CF-CHG", "fallback.jpg"),
    "/images/shop/eventuri/eve-g9x-cf-chg-hero.jpg"
  );
  assert.equal(resolveShopWarehouseHeroImage("EVE-FLC", "fallback.jpg"), "fallback.jpg");
});
