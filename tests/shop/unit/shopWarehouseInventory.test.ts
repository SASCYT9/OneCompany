import test from "node:test";
import assert from "node:assert/strict";

import {
  getShopWarehouseStockStatus,
  isShopWarehouseInStockProduct,
  isShopWarehouseInStockSku,
  resolveShopWarehouseHeroImage,
  resolveShopWarehouseProductCopy,
  SHOP_WAREHOUSE_IN_STOCK_FI_EXHAUST_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_KW_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SLUGS,
} from "../../../src/lib/shopWarehouseInventory";

test("warehouse inventory contains the confirmed Eventuri, KW, Fi EXHAUST, and iPE SKUs", () => {
  assert.deepEqual(SHOP_WAREHOUSE_IN_STOCK_KW_SKUS, [
    "253200EB",
    "253200CC",
    "253200ED",
    "253200CW",
    "2532500Y",
    "253200GG",
  ]);
  assert.deepEqual(SHOP_WAREHOUSE_IN_STOCK_FI_EXHAUST_SKUS, [
    "BN-G82MF-CBE + TIP70114S*4 + CAB-BTB*2",
  ]);
  assert.equal(SHOP_WAREHOUSE_IN_STOCK_SKUS.length, 19);
  assert.equal(new Set(SHOP_WAREHOUSE_IN_STOCK_SKUS).size, 19);
  assert.equal(SHOP_WAREHOUSE_IN_STOCK_SKUS.every(isShopWarehouseInStockSku), true);
});

test("iPE X5 M / X6 M LCI product is matched by canonical SKU and exact slug", () => {
  assert.deepEqual(SHOP_WAREHOUSE_IN_STOCK_SLUGS, ["ipe-bmw-x5m-x6m-f95-f96-exhaust-system"]);
  assert.equal(isShopWarehouseInStockProduct(null, SHOP_WAREHOUSE_IN_STOCK_SLUGS[0]), true);
  assert.equal(isShopWarehouseInStockProduct("0WX595-NVNM0-2", null), true);
  assert.equal(isShopWarehouseInStockProduct(null, "bmw-x5m-x6m-f95-f96-exhaust"), false);
  const copy = resolveShopWarehouseProductCopy(
    null,
    "ua",
    { title: "fallback", description: "fallback" },
    SHOP_WAREHOUSE_IN_STOCK_SLUGS[0]
  );
  assert.match(copy.title, /LCI/);
  assert.match(copy.description, /iPE/);
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
