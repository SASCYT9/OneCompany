import test from "node:test";
import assert from "node:assert/strict";
import { buildPagedListingMetadata, parseListingPage } from "../../../src/lib/pagedListingMetadata";
import { paginateProducts } from "../../../src/app/[locale]/shop/components/ShopPaginationNav";

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
    2
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

test("pagination never clamps invalid or out-of-range pages to indexable slices", () => {
  const products = Array.from({ length: 61 }, (_, index) => index + 1);

  assert.deepEqual(paginateProducts(products, 2, 30), {
    pageProducts: products.slice(30, 60),
    currentPage: 2,
    totalPages: 3,
    isValidPage: true,
  });
  assert.deepEqual(paginateProducts(products, 999999, 30), {
    pageProducts: [],
    currentPage: 999999,
    totalPages: 3,
    isValidPage: false,
  });
  assert.equal(paginateProducts(products, 0, 30).isValidPage, false);
});
