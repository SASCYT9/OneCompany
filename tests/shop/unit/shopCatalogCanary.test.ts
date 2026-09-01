import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateShopCatalogCanary,
  parseShopCatalogCanaryConfig,
  shopCatalogCanaryBucket,
} from "../../../src/lib/shopCatalogCanary";

test("canary allocation is deterministic and bounded", () => {
  assert.equal(shopCatalogCanaryBucket("visitor-42"), shopCatalogCanaryBucket("visitor-42"));
  assert.ok(shopCatalogCanaryBucket("visitor-42") >= 0);
  assert.ok(shopCatalogCanaryBucket("visitor-42") < 100);
  const off = parseShopCatalogCanaryConfig({ SHOP_CATALOG_V2_CANARY_PERCENTAGE: "invalid" });
  const full = parseShopCatalogCanaryConfig({ SHOP_CATALOG_V2_CANARY_PERCENTAGE: "500" });
  assert.equal(off.percentage, 0);
  assert.equal(full.percentage, 100);
});

test("canary enforces locale, brand, and category segments without broadening", () => {
  const config = parseShopCatalogCanaryConfig({
    SHOP_CATALOG_V2_CANARY_PERCENTAGE: "100",
    SHOP_CATALOG_V2_CANARY_LOCALES: "ua",
    SHOP_CATALOG_V2_CANARY_BRANDS: "RaceChip, Eventuri",
    SHOP_CATALOG_V2_CANARY_CATEGORIES: "performance",
  });
  const base = { config, rolloutId: "visitor", locale: "ua", brand: "racechip", category: "performance" };
  assert.equal(evaluateShopCatalogCanary(base), true);
  assert.equal(evaluateShopCatalogCanary({ ...base, locale: "en" }), false);
  assert.equal(evaluateShopCatalogCanary({ ...base, brand: null }), false);
  assert.equal(evaluateShopCatalogCanary({ ...base, category: "aero" }), false);
});

test("zero-percent rollback sends every segment to the legacy reader", () => {
  const config = parseShopCatalogCanaryConfig({ SHOP_CATALOG_V2_CANARY_PERCENTAGE: "0" });
  for (const rolloutId of ["a", "b", "visitor-42", "visitor-99"]) {
    assert.equal(evaluateShopCatalogCanary({ config, rolloutId, locale: "ua", brand: null, category: null }), false);
  }
});
