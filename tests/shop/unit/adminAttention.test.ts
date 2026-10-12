import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminAttentionItems,
  buildAdminNavBadges,
  type AdminAttentionCounts,
} from "../../../src/lib/admin/adminAttention";

const EMPTY: AdminAttentionCounts = {
  ordersToReview: null,
  unpaidHighValueOrders: null,
  returnsRequested: null,
  newMessages: null,
  b2bPending: null,
  failedImportsRecent: null,
};

test("counters the admin may not read, or that are zero, stay out of the bell and badges", () => {
  const counts = { ...EMPTY, ordersToReview: 0, newMessages: null, b2bPending: 2 };
  assert.deepEqual(
    buildAdminAttentionItems(counts).map((item) => [item.id, item.count]),
    [["b2bPending", 2]]
  );
  assert.deepEqual(buildAdminNavBadges(counts), { "/admin/shop/customers": 2 });
});

test("nav badges only count actionable queues; the bell lists every non-zero counter", () => {
  const counts = {
    ...EMPTY,
    ordersToReview: 3,
    unpaidHighValueOrders: 5,
    newMessages: 4,
    returnsRequested: 1,
    failedImportsRecent: 2,
  };
  assert.deepEqual(buildAdminNavBadges(counts), {
    "/admin/shop/orders": 3,
    "/admin/messages": 4,
    "/admin/shop/returns": 1,
    "/admin/shop/import": 2,
  });
  const items = buildAdminAttentionItems(counts);
  assert.equal(items.length, 5);
  assert.equal(
    items.reduce((sum, item) => sum + item.count, 0),
    15
  );
  assert.ok(items.every((item) => item.href.startsWith("/admin/")));
});
