import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("stock suggestions use the bounded projection when Catalog V2 serves SSR", () => {
  const route = readFileSync("src/app/api/shop/stock/suggest/route.ts", "utf8");
  const projectionBranch = route.indexOf("queryProjectionSuggestions({");
  const legacyLoader = route.indexOf("getShopProductsWithFitments()");

  assert.notEqual(projectionBranch, -1, "projection suggestion branch is present");
  assert.notEqual(legacyLoader, -1, "legacy fallback remains available");
  assert.ok(
    projectionBranch < legacyLoader,
    "the bounded projection must be selected before the full-catalog fallback"
  );
  assert.match(route, /isShopCatalogReaderRequestEnabled\(/);
  assert.match(route, /SHOP_CATALOG_CANARY_REQUEST_HEADER/);
  assert.match(route, /databaseQueriesUpperBound: 3/);
});

test("projection suggestions retain token and normalized SKU matching", () => {
  const service = readFileSync("src/lib/shopCatalogSuggestion.server.ts", "utf8");
  assert.match(service, /tokenizeShopSearchQuery/);
  assert.match(service, /coalesce\(projection\.\"normalizedSku\", ''\)/);
  assert.match(service, /Prisma\.join\(tokenConditions, \" AND \"\)/);
});
