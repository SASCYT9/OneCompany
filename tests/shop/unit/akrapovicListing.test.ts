import test from "node:test";
import assert from "node:assert/strict";
import {
  AKRAPOVIC_LISTING_PAGE_SIZE,
  buildAkrapovicInitialQuery,
  buildAkrapovicListingPath,
  hasAkrapovicListingFilters,
  isAkrapovicMotoScope,
  resolveAkrapovicPagination,
} from "../../../src/lib/akrapovicListing";

test("moto scope is read from either `scope` or `segment`", () => {
  assert.equal(isAkrapovicMotoScope({ scope: "moto" }), true);
  assert.equal(isAkrapovicMotoScope({ segment: "moto" }), true);
  assert.equal(isAkrapovicMotoScope({ segment: ["moto", "auto"] }), true);
  assert.equal(isAkrapovicMotoScope({ scope: "auto" }), false);
  assert.equal(isAkrapovicMotoScope({}), false);
});

test("initial query keeps only known, non-empty filter keys", () => {
  const query = buildAkrapovicInitialQuery({
    brand: "BMW",
    model: " M3 ",
    q: "",
    scope: "moto",
  });
  assert.equal(new URLSearchParams(query).get("brand"), "BMW");
  assert.equal(new URLSearchParams(query).get("model"), "M3");
  assert.equal(new URLSearchParams(query).get("scope"), "moto");
  assert.equal(new URLSearchParams(query).has("q"), false);
  assert.equal(buildAkrapovicInitialQuery({}), "");
});

test("filters are detected independently of scope", () => {
  assert.equal(hasAkrapovicListingFilters({ scope: "moto" }), false);
  assert.equal(hasAkrapovicListingFilters({ q: "exhaust" }), true);
  assert.equal(hasAkrapovicListingFilters({ year: "2020" }), true);
});

test("pagination validates the requested page against the product count", () => {
  const size = AKRAPOVIC_LISTING_PAGE_SIZE;
  assert.deepEqual(resolveAkrapovicPagination(size * 3, 3), {
    totalPages: 3,
    isValidPage: true,
    page: 3,
  });
  assert.equal(resolveAkrapovicPagination(size * 3, 4).isValidPage, false);
  assert.equal(resolveAkrapovicPagination(size * 3 + 1, 4).isValidPage, true);
  assert.equal(resolveAkrapovicPagination(10, 1).totalPages, 1);
  assert.equal(resolveAkrapovicPagination(0, 1).isValidPage, true);
  assert.equal(resolveAkrapovicPagination(100, 0).isValidPage, false);
  assert.equal(resolveAkrapovicPagination(100, 1.5).isValidPage, false);
});

test("listing path puts page 1 on the base URL", () => {
  assert.equal(buildAkrapovicListingPath("ua", 1), "/ua/shop/akrapovic/collections");
  assert.equal(buildAkrapovicListingPath("en", 3), "/en/shop/akrapovic/collections/page/3");
});
