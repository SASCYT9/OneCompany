import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerTestModuleHooks } from "./testHooks.mjs";

registerTestModuleHooks({
  mockUrl: pathToFileURL(path.resolve("tests/shop/unit/fixtures/warehouse-cache-mocks.mjs")).href,
  mockedAliases: ["@/lib/prisma"],
});

test("warehouse reads coalesce, refresh after expiry, and recover after rejection", async (t) => {
  const { getShopWarehouseProducts, invalidateShopWarehouseProductsCache } =
    await import("../../../src/lib/shopWarehouseInventory.server");
  const { state } = await import("./fixtures/warehouse-cache-mocks.mjs");
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const [first, second] = await Promise.all([
    getShopWarehouseProducts(),
    getShopWarehouseProducts(),
  ]);
  assert.deepEqual(first, [{ id: "stock-1", sku: "SKU", slug: "stock" }]);
  assert.strictEqual(first, second);
  assert.equal(state.calls.length, 1);
  assert.strictEqual(await getShopWarehouseProducts(), first);
  assert.deepEqual(state.calls[0].select, { id: true, sku: true, slug: true });
  assert.equal(state.calls[0].where.isPublished, true);
  assert.equal(state.calls[0].where.status, "ACTIVE");
  invalidateShopWarehouseProductsCache();
  assert.deepEqual(await getShopWarehouseProducts(), [
    { id: "stock-2", sku: "SKU", slug: "stock" },
  ]);
  now += 30_001;
  assert.deepEqual(await getShopWarehouseProducts(), [
    { id: "stock-3", sku: "SKU", slug: "stock" },
  ]);
  now += 30_001;
  state.fail = true;
  await assert.rejects(getShopWarehouseProducts(), /warehouse unavailable/);
  state.fail = false;
  assert.deepEqual(await getShopWarehouseProducts(), [
    { id: "stock-5", sku: "SKU", slug: "stock" },
  ]);
  assert.equal(state.calls.length, 5);
});
