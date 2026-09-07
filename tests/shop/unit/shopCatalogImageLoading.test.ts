import assert from "node:assert/strict";
import test from "node:test";

import { getShopCatalogImageLoading } from "../../../src/lib/shopCatalogImageLoading";

test("catalog preloads only the first card for mobile LCP", () => {
  assert.deepEqual(getShopCatalogImageLoading(0), { preload: true, loading: "eager" });
  assert.deepEqual(getShopCatalogImageLoading(1), { preload: false, loading: "lazy" });
  assert.deepEqual(getShopCatalogImageLoading(3), { preload: false, loading: "lazy" });
});

test("invalid card indexes fail closed to lazy loading", () => {
  assert.deepEqual(getShopCatalogImageLoading(-1), { preload: false, loading: "lazy" });
  assert.deepEqual(getShopCatalogImageLoading(1.5), { preload: false, loading: "lazy" });
});
