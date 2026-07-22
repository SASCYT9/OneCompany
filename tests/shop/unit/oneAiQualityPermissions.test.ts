import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ADMIN_NAV_SECTIONS, getActiveAdminNavItem } from "../../../src/lib/admin/adminNavigation";
import { ADMIN_PERMISSIONS } from "../../../src/lib/adminRbac";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("One AI quality exposes the three explicit permissions and admin navigation", () => {
  assert.deepEqual(
    [
      ADMIN_PERMISSIONS.SHOP_AI_READ,
      ADMIN_PERMISSIONS.SHOP_AI_REVIEW,
      ADMIN_PERMISSIONS.SHOP_AI_MANAGE,
    ],
    ["shop.ai.read", "shop.ai.review", "shop.ai.manage"]
  );

  const item = ADMIN_NAV_SECTIONS.find((section) => section.key === "catalog")?.items.find(
    (candidate) => candidate.href === "/admin/shop/ai-quality"
  );
  assert.ok(item);
  assert.equal(getActiveAdminNavItem("/admin/shop/ai-quality")?.href, item.href);
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
