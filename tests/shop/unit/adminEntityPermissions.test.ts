import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAdminEntityPermission,
  resolveAdminEntityPermission,
} from "../../../src/lib/admin/adminEntityPermissions";

test("admin entity permissions isolate commerce domains", () => {
  assert.equal(resolveAdminEntityPermission("shop.product", "read"), "shop.products.read");
  assert.equal(resolveAdminEntityPermission("shop.order", "write"), "shop.orders.write");
  assert.equal(resolveAdminEntityPermission("shop.customer", "read"), "shop.customers.read");
  assert.equal(resolveAdminEntityPermission("shop.inventory", "read"), "shop.inventory.read");
  assert.equal(resolveAdminEntityPermission("shop.unknown", "read"), null);
});

test("task-only access cannot cross into a commerce entity", () => {
  assert.throws(
    () =>
      assertAdminEntityPermission(
        { permissions: ["ops.tasks.read", "ops.tasks.write"] },
        "shop.product",
        "read"
      ),
    /FORBIDDEN/
  );

  assert.equal(
    assertAdminEntityPermission({ permissions: ["shop.products.read"] }, "shop.product", "read"),
    "shop.products.read"
  );
});
