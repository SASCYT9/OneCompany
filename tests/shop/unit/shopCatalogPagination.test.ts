import assert from "node:assert/strict";
import test from "node:test";
import { nextPageHref } from "../../../src/lib/shopCatalogPagination";
import { parseShopCatalogStorefrontQuery } from "../../../src/lib/shopCatalogStorefrontQuery";
import type { ShopCatalogProjectionQueryResult } from "../../../src/lib/shopCatalogProjectionQuery.server";

const result: ShopCatalogProjectionQueryResult = {
  source: "catalog_v2_projection",
  items: [],
  hasMore: true,
  nextCursor: null,
};

test("sorted listings keep pagination and all filters without an incompatible rank cursor", () => {
  for (const sort of ["price_asc", "price_desc", "name_asc", "brand_interleave"]) {
    const query = parseShopCatalogStorefrontQuery(
      "ua",
      new URLSearchParams(
        `sort=${sort}&page=2&stock=inStock&minPrice=100&currency=EUR&make=BMW&model=M5&chassis=G90`
      )
    );
    const href = nextPageHref("ua", query, result);
    assert.ok(href);
    const params = new URL(href, "http://localhost").searchParams;
    assert.equal(params.get("page"), "3");
    assert.equal(params.get("afterRank"), null);
    const parsed = parseShopCatalogStorefrontQuery("ua", params);
    assert.equal(parsed.offset, 48);
    assert.equal(parsed.order, sort);
    assert.equal(parsed.stock, "inStock");
    assert.equal(parsed.minPrice, 100);
    assert.equal(parsed.generation, "G90");
  }
});

test("default listing retains keyset pagination and last pages have no continuation", () => {
  const query = parseShopCatalogStorefrontQuery("en", new URLSearchParams("make=BMW"));
  const cursorResult = { ...result, nextCursor: { stableRank: "12", productId: "p42" } };
  const href = nextPageHref("en", query, cursorResult);
  assert.ok(href);
  const parsed = parseShopCatalogStorefrontQuery(
    "en",
    new URL(href, "http://localhost").searchParams
  );
  assert.deepEqual(parsed.after, cursorResult.nextCursor);
  assert.equal(nextPageHref("en", query, { ...cursorResult, hasMore: false }), null);
  const capped = parseShopCatalogStorefrontQuery(
    "en",
    new URLSearchParams("sort=price_asc&page=10000")
  );
  assert.equal(nextPageHref("en", capped, result), null);
});
