import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ADMIN_PERMISSIONS } from "../../../src/lib/adminRbac";

function source(path: string) {
  return readFileSync(path, "utf8");
}

// The page left the sidebar in the manager workflow streamline (c19e67f7); its API
// routes still enforce the dedicated permissions checked below.
test("One AI quality exposes the three explicit permissions", () => {
  assert.deepEqual(
    [
      ADMIN_PERMISSIONS.SHOP_AI_READ,
      ADMIN_PERMISSIONS.SHOP_AI_REVIEW,
      ADMIN_PERMISSIONS.SHOP_AI_MANAGE,
    ],
    ["shop.ai.read", "shop.ai.review", "shop.ai.manage"]
  );

});

test("One AI quality routes enforce read, review and manage boundaries", () => {
  assert.match(
    source("src/app/api/admin/shop/ai-quality/route.ts"),
    /ADMIN_PERMISSIONS\.SHOP_AI_READ/
  );

  const productRoute = source("src/app/api/admin/shop/ai-quality/products/[productId]/route.ts");
  assert.match(productRoute, /ADMIN_PERMISSIONS\.SHOP_AI_REVIEW/);
  assert.match(productRoute, /ADMIN_PERMISSIONS\.SHOP_AI_MANAGE/);

  for (const path of [
    "src/app/api/admin/shop/ai-quality/bulk/preview/route.ts",
    "src/app/api/admin/shop/ai-quality/bulk/apply/route.ts",
  ]) {
    assert.match(source(path), /ADMIN_PERMISSIONS\.SHOP_AI_MANAGE/);
  }
});
