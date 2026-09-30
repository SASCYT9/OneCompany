import test from "node:test";
import assert from "node:assert/strict";

import {
  isEventuriBrand,
  shouldShowEventuriStockBadge,
  shouldShowShopStockVehicleMatch,
  toggleShopStockBrandSelection,
} from "../../../src/lib/shopStockUi";

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

test("pending and failed vehicle requests cannot claim fitment for previous cards", () => {
  assert.equal(
    shouldShowShopStockVehicleMatch({ hasVehicle: true, loading: true, error: null }),
    false
  );
  assert.equal(
    shouldShowShopStockVehicleMatch({ hasVehicle: true, loading: false, error: "failed" }),
    false
  );
  assert.equal(
    shouldShowShopStockVehicleMatch({ hasVehicle: false, loading: false, error: null }),
    false
  );
  assert.equal(
    shouldShowShopStockVehicleMatch({ hasVehicle: true, loading: false, error: null }),
    true
  );
});

test("brand selection adds a second brand and removes only the chosen chip", () => {
  assert.deepEqual(toggleShopStockBrandSelection(["Eventuri"], "CSF"), ["Eventuri", "CSF"]);
  assert.deepEqual(toggleShopStockBrandSelection(["Eventuri", "CSF"], "eventuri"), ["CSF"]);
  assert.deepEqual(toggleShopStockBrandSelection(["CSF"], " "), ["CSF"]);
});
