import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const route = readFileSync(
  path.resolve("src/app/api/admin/shop/products/bulk-status/route.ts"),
  "utf8"
);

test("bulk status writer publishes every product through the catalog coordinator", () => {
  assert.match(route, /coordinateShopCatalogProductMutation/);
  assert.match(route, /expectedCatalogVersion/);
  assert.match(route, /changeDomains:\s*\["VISIBILITY"\]/);
  assert.match(route, /buildShopCatalogAdminSnapshot/);
  assert.match(route, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(route, /shopProduct\.updateMany/);
});

test("bulk status writer fails before mutation for missing products and reports conflicts", () => {
  assert.match(route, /products\.length !== uniqueIds\.length/);
  assert.match(route, /missingIds/);
  assert.match(route, /Catalog version conflict/);
  assert.match(route, /status:\s*409/);
});
