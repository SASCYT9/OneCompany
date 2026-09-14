import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerTestModuleHooks } from "./testHooks.mjs";

registerTestModuleHooks({
  mockUrl: pathToFileURL(path.resolve("tests/shop/unit/fixtures/warehouse-cache-mocks.mjs")).href,
  mockedAliases: ["@/lib/prisma"],
});

test("available product lookup applies saved manager controls and refreshes after editing", async () => {
  const { getShopInStockProducts, invalidateShopWarehouseProductsCache } =
    await import("../../../src/lib/shopWarehouseInventory.server");
  const { state } = await import("./fixtures/warehouse-cache-mocks.mjs");
  const metadata = (showInStock: boolean) => [
    {
      namespace: "onecompany",
      key: "storefront_display",
      value: JSON.stringify({ availability: "inStock", showInStock, showInCarousel: false }),
    },
  ];
  state.rows = [
    { id: "hidden-legacy", sku: "85230", slug: "old", metafields: metadata(false) },
    { id: "enabled-new", sku: "NEW-SKU", slug: "new", metafields: metadata(true) },
    { id: "adapter", sku: "BM3-WIFI-ADAPTER", slug: "adapter", metafields: [] },
  ];
  invalidateShopWarehouseProductsCache();
  assert.deepEqual(await getShopInStockProducts(), [
    { id: "enabled-new", sku: "NEW-SKU", slug: "new" },
  ]);
  state.rows[1].metafields = metadata(false);
  invalidateShopWarehouseProductsCache();
  assert.deepEqual(await getShopInStockProducts(), []);
  state.rows = null;
  invalidateShopWarehouseProductsCache();
});

test("warehouse reads coalesce, refresh after expiry, and recover after rejection", async (t) => {
  const { getShopInStockProducts, invalidateShopWarehouseProductsCache } =
    await import("../../../src/lib/shopWarehouseInventory.server");
  const { state } = await import("./fixtures/warehouse-cache-mocks.mjs");
  let now = Date.now();
  state.calls.length = 0;
  state.fail = false;
  state.rows = null;
  invalidateShopWarehouseProductsCache();
  t.mock.method(Date, "now", () => now);
  const [first, second] = await Promise.all([getShopInStockProducts(), getShopInStockProducts()]);
  assert.deepEqual(first, [{ id: "stock-1", sku: "85230", slug: "stock" }]);
  assert.strictEqual(first, second);
  assert.equal(state.calls.length, 1);
  assert.strictEqual(await getShopInStockProducts(), first);
  assert.equal(state.calls[0].select.id, true);
  assert.deepEqual(state.calls[0].select.metafields.where, {
    namespace: "onecompany",
    key: "storefront_display",
  });
  assert.equal(state.calls[0].where.isPublished, true);
  assert.equal(state.calls[0].where.status, "ACTIVE");
  invalidateShopWarehouseProductsCache();
  assert.deepEqual(await getShopInStockProducts(), [
    { id: "stock-2", sku: "85230", slug: "stock" },
  ]);
  now += 30_001;
  assert.deepEqual(await getShopInStockProducts(), [
    { id: "stock-3", sku: "85230", slug: "stock" },
  ]);
  now += 30_001;
  state.fail = true;
  await assert.rejects(getShopInStockProducts(), /warehouse unavailable/);
  state.fail = false;
  assert.deepEqual(await getShopInStockProducts(), [
    { id: "stock-5", sku: "85230", slug: "stock" },
  ]);
  assert.equal(state.calls.length, 5);
});
