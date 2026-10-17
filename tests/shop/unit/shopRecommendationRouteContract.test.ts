import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V2 recommendations resolve a bounded projection candidate set", () => {
  const loader = readFileSync("src/lib/crossShopRecommendations.server.ts", "utf8");
  const bounded = loader.indexOf("getShopRecommendationProductsForFitmentServer(");
  const legacy = loader.indexOf("getShopRecommendationProductsServer()");

  assert.notEqual(bounded, -1, "bounded V2 recommendation loader is present");
  assert.notEqual(legacy, -1, "reader-off compatibility loader remains available");
  assert.match(loader, /isShopCatalogReaderRequestEnabled\(reader, canaryHeader\)/);
  assert.ok(
    bounded < legacy,
    "the V2 branch must be selected before the legacy full-catalog compatibility path"
  );

  // The API passes the canary header; the product page block only runs the
  // bounded reader and otherwise leaves the cards to the API on scroll.
  const route = readFileSync("src/app/api/shop/recommendations/route.ts", "utf8");
  assert.match(route, /SHOP_CATALOG_CANARY_REQUEST_HEADER/);
  assert.match(route, /loadCrossShopRecommendations\(/);
  assert.match(
    loader,
    /export async function loadCrossShopRecommendationsSafely[\s\S]*?if \(!isShopCatalogReaderRequestEnabled\(reader, null\)\) return null;/
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
