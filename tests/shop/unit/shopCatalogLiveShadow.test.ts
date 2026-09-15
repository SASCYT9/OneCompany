import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compareShopCatalogLiveShadowPage } from "../../../src/lib/shopCatalogLiveShadow";

test("live shadow comparison permits ranking changes without hiding complete-set loss", () => {
  assert.equal(
    compareShopCatalogLiveShadowPage({
      legacyProductIds: ["p1", "p2"],
      projectionProductIds: ["p1", "p2"],
      legacyHasMore: true,
      projectionHasMore: true,
    }).parity,
    true
  );

  const reordered = compareShopCatalogLiveShadowPage({
    legacyProductIds: ["p1", "p2"],
    projectionProductIds: ["p2", "p1"],
    legacyHasMore: false,
    projectionHasMore: false,
  });
  assert.equal(reordered.parity, true);
  assert.equal(reordered.comparisonCompleteness, "complete_result_set");
  assert.equal(reordered.orderMismatchCount, 2);

  const rerankedWindow = compareShopCatalogLiveShadowPage({
    legacyProductIds: ["p1", "p2"],
    projectionProductIds: ["p3", "p4"],
    legacyHasMore: true,
    projectionHasMore: true,
  });
  assert.equal(rerankedWindow.parity, true);
  assert.equal(rerankedWindow.comparisonCompleteness, "bounded_window");

  const mismatch = compareShopCatalogLiveShadowPage({
    legacyProductIds: ["p1", "p2"],
    projectionProductIds: ["p2", "p3"],
    legacyHasMore: false,
    projectionHasMore: true,
  });
  assert.equal(mismatch.parity, false);
  assert.deepEqual(mismatch.missingProductIds, ["p1"]);
  assert.deepEqual(mismatch.unexpectedProductIds, ["p3"]);
  assert.equal(mismatch.orderMismatchCount, 2);
});

test("live stock endpoint runs compare-only shadow reads without serving projection data", () => {
  const source = readFileSync(
    new URL("../../../src/lib/shopStockSearch.server.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /resolveShopCatalogShadowFlag/);
  assert.match(source, /queryShopCatalogProjectionShadow/);
  assert.match(source, /compareShopCatalogLiveShadowPage/);
  assert.match(source, /catalog_v2_shadow_page_comparison/);
  assert.match(source, /source: "local"/);
  assert.doesNotMatch(source, /source:\s*"catalog_v2_projection"/);
});
