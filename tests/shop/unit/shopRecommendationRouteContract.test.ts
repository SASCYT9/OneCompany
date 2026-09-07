import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V2 recommendations resolve a bounded projection candidate set", () => {
  const route = readFileSync("src/app/api/shop/recommendations/route.ts", "utf8");
  const bounded = route.indexOf("getShopRecommendationProductsForFitmentServer");
  const legacy = route.indexOf("getShopRecommendationProductsServer");

  assert.notEqual(bounded, -1, "bounded V2 recommendation loader is present");
  assert.notEqual(legacy, -1, "reader-off compatibility loader remains available");
  assert.match(route, /SHOP_CATALOG_CANARY_REQUEST_HEADER/);
  assert.match(route, /isShopCatalogReaderRequestEnabled\(/);
  assert.ok(
    bounded < legacy,
    "the V2 branch must be selected before the legacy full-catalog compatibility path"
  );
});

test("bounded recommendation hydration is identity-limited", () => {
  const source = readFileSync("src/lib/shopCatalogServer.ts", "utf8");
  const start = source.indexOf(
    "export async function getShopRecommendationProductsForFitmentServer"
  );
  assert.notEqual(start, -1, "bounded recommendation helper is present");
  const section = source.slice(start, source.indexOf("export type ShopProductLookupResult", start));

  assert.match(section, /queryShopCatalogProjection\(/);
  assert.match(section, /limit: 100/);
  assert.match(section, /order: "brand_interleave"/);
  assert.match(section, /getShopProductsByIdsServer\(result\.items\.map/);
  assert.match(section, /return \[\]/);
});
