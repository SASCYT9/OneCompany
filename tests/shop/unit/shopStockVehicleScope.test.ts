import test from "node:test";
import assert from "node:assert/strict";

import {
  filterShopStockItemsByVehicleScope,
  parseShopStockVehicleScope,
  resolveShopStockVehicleScope,
} from "../../../src/lib/shopStockVehicleScope";

test("parseShopStockVehicleScope accepts only auto and moto", () => {
  assert.equal(parseShopStockVehicleScope(" AUTO "), "auto");
  assert.equal(parseShopStockVehicleScope("moto"), "moto");
  assert.equal(parseShopStockVehicleScope("SHOP"), null);
  assert.equal(parseShopStockVehicleScope(null), null);
});

test("resolveShopStockVehicleScope preserves valid explicit product scope", () => {
  assert.equal(resolveShopStockVehicleScope("auto", "motorcycle"), "auto");
  assert.equal(resolveShopStockVehicleScope("moto", "car"), "moto");
});

test("resolveShopStockVehicleScope repairs legacy SHOP scope from normalized fitment", () => {
  assert.equal(resolveShopStockVehicleScope("SHOP", "motorcycle"), "moto");
  assert.equal(resolveShopStockVehicleScope("SHOP", "car"), "auto");
  assert.equal(resolveShopStockVehicleScope("SHOP", "unknown"), "auto");
});

test("filterShopStockItemsByVehicleScope is optional and isolates scopes", () => {
  const items = [
    { id: "auto-1", vehicleScope: "auto" as const },
    { id: "moto-1", vehicleScope: "moto" as const },
    { id: "auto-2", vehicleScope: "auto" as const },
  ];

  assert.equal(filterShopStockItemsByVehicleScope(items, null), items);
  assert.deepEqual(
    filterShopStockItemsByVehicleScope(items, "auto").map((item) => item.id),
    ["auto-1", "auto-2"]
  );
  assert.deepEqual(
    filterShopStockItemsByVehicleScope(items, "moto").map((item) => item.id),
    ["moto-1"]
  );
});
