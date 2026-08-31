import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const route = readFileSync(path.resolve("src/app/api/admin/shop/products/route.ts"), "utf8");

test("manual product creation atomically publishes catalog version one", () => {
  assert.match(route, /coordinateShopCatalogProductCreation/);
  assert.match(route, /buildShopCatalogAdminSnapshot/);
  assert.match(route, /writeAdminAuditLog\(tx/);
  assert.match(route, /runShopCatalogOutboxRuntime/);
  assert.match(route, /catalogMutation\.canonicalVersion/);
  assert.doesNotMatch(route, /const product = await prisma\.\$transaction/);
});
