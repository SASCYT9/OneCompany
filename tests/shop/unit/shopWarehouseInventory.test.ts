import test from "node:test";
import assert from "node:assert/strict";

import {
  getShopWarehouseStockStatus,
  isShopWarehouseInStockSku,
  resolveShopWarehouseHeroImage,
  resolveShopWarehouseProductCopy,
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
} from "../../../src/lib/shopWarehouseInventory";

test("warehouse inventory contains the eleven confirmed Eventuri SKUs", () => {
  assert.equal(SHOP_WAREHOUSE_IN_STOCK_SKUS.length, 11);
  assert.equal(new Set(SHOP_WAREHOUSE_IN_STOCK_SKUS).size, 11);
  assert.equal(SHOP_WAREHOUSE_IN_STOCK_SKUS.every(isShopWarehouseInStockSku), true);
});

test("every confirmed warehouse SKU has curated bilingual storefront copy", () => {
  for (const sku of SHOP_WAREHOUSE_IN_STOCK_SKUS) {
    for (const locale of ["ua", "en"] as const) {
      const copy = resolveShopWarehouseProductCopy(sku, locale, {
        title: "fallback title",
        description: "fallback description",
      });

      assert.notEqual(copy.title, "fallback title", `${sku} is missing a ${locale} title`);
      assert.notEqual(
        copy.description,
        "fallback description",
        `${sku} is missing a ${locale} description`
      );
      assert.ok(copy.title.length >= 18);
      assert.ok(copy.description.length >= 50);
    }
  }
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
