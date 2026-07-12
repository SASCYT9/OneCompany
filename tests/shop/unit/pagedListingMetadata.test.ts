import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPagedListingMetadata,
  hasListingFilters,
  parseListingPage,
} from "../../../src/lib/pagedListingMetadata";

test("parseListingPage accepts positive integer path segments only", () => {
  assert.equal(parseListingPage("2"), 2);
  assert.equal(parseListingPage("100"), 100);
  assert.equal(parseListingPage("0"), null);
  assert.equal(parseListingPage("-1"), null);
  assert.equal(parseListingPage("2.5"), null);
});

test("paged listing metadata is self-canonical with reciprocal locale links", () => {
  const metadata = buildPagedListingMetadata(
    { title: "Catalog", openGraph: { title: "Catalog", type: "website" } },
    "en",
    "shop/racechip/catalog",
    2,
    false
  );
  assert.equal(
    metadata.alternates?.canonical,
    "https://onecompany.global/en/shop/racechip/catalog/page/2"
  );
  assert.deepEqual(metadata.alternates?.languages, {
    uk: "https://onecompany.global/ua/shop/racechip/catalog/page/2",
    en: "https://onecompany.global/en/shop/racechip/catalog/page/2",
    "x-default": "https://onecompany.global/ua/shop/racechip/catalog/page/2",
  });
  assert.equal(metadata.robots, undefined);
});

test("filter params noindex a page while legacy page query alone does not", () => {
  assert.equal(hasListingFilters({ page: "2" }), false);
  assert.equal(hasListingFilters({ page: "2", make: "BMW" }), true);
  const metadata = buildPagedListingMetadata({}, "ua", "shop/ohlins/catalog", 3, true);
  assert.deepEqual(metadata.robots, { index: false, follow: true });
});
