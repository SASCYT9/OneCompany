import test from "node:test";
import assert from "node:assert/strict";

import { isEventuriBrand, shouldShowEventuriStockBadge } from "../../../src/lib/shopStockUi";

test("Eventuri stock badge is limited to the exact brand and in-stock state", () => {
  assert.equal(shouldShowEventuriStockBadge("Eventuri", "inStock"), true);
  assert.equal(shouldShowEventuriStockBadge("eventuri", "inStock"), true);
  assert.equal(shouldShowEventuriStockBadge("Eventuri", "preOrder"), false);
  assert.equal(shouldShowEventuriStockBadge("KW", "inStock"), false);
  assert.equal(shouldShowEventuriStockBadge(null, "inStock"), false);
});

test("brand matching trims case without treating other brands as Eventuri", () => {
  assert.equal(isEventuriBrand(" Eventuri "), true);
  assert.equal(isEventuriBrand("KW Suspension"), false);
  assert.equal(isEventuriBrand(undefined), false);
});
