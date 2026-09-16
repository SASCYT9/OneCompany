import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCatalogBrochureDiscount,
  applyCatalogBrochureFixedDiscount,
  catalogBrochurePrice,
  catalogBrochureProductPageCount,
  validateCatalogBrochureRequest,
} from "../../../src/lib/admin/catalogBrochure";
import { catalogImageSources } from "../../../src/lib/admin/catalogImageSources";

const validRequest = {
  title: "Urban G580 EQ",
  subtitle: "Представницький каталог",
  language: "ua",
  currency: "EUR",
  layout: "single",
  branding: "onecompany",
  showPrice: true,
  items: [{ productId: "product-1", priceOverride: null }],
} as const;

test("accepts a valid brochure request and optional zero price", () => {
  assert.equal(validateCatalogBrochureRequest(validRequest), null);
  assert.equal(
    validateCatalogBrochureRequest({
      ...validRequest,
      items: [{ productId: "product-1", priceOverride: 0 }],
    }),
    null
  );
  assert.equal(
    validateCatalogBrochureRequest({
      ...validRequest,
      items: [{ productId: "product-1", imageSource: "https://cdn.example.com/product.jpg" }],
    }),
    null
  );
});

test("rejects malformed product photo overrides", () => {
  const error = validateCatalogBrochureRequest({
    ...validRequest,
    items: [{ productId: "product-1", imageSource: "https://cdn.example.com/bad\nphoto.jpg" }],
  });
  assert.ok(error);
  assert.match(error, /фото/i);
});

test("requires a brand when brand branding is selected", () => {
  const error = validateCatalogBrochureRequest({ ...validRequest, branding: "brand" });
  assert.ok(error);
  assert.match(error, /бренд/i);
});

test("rejects duplicate products and invalid money precision", () => {
  const duplicateError = validateCatalogBrochureRequest({
    ...validRequest,
    items: [
      { productId: "product-1", priceOverride: null },
      { productId: "product-1", priceOverride: null },
    ],
  });
  assert.ok(duplicateError);
  assert.match(duplicateError, /двічі/i);

  const precisionError = validateCatalogBrochureRequest({
    ...validRequest,
    items: [{ productId: "product-1", priceOverride: 10.001 }],
  });
  assert.ok(precisionError);
  assert.match(precisionError, /копійок/i);
});

test("selects the requested currency price", () => {
  const product = { priceEur: 100, priceUsd: 110, priceUah: 4500 };
  assert.equal(catalogBrochurePrice(product, "EUR"), 100);
  assert.equal(catalogBrochurePrice(product, "USD"), 110);
  assert.equal(catalogBrochurePrice(product, "UAH"), 4500);
  assert.equal(catalogBrochurePrice({ priceEur: null }, "EUR"), null);
});

test("applies custom percentage and fixed brochure discounts", () => {
  assert.equal(applyCatalogBrochureDiscount(2690, 7.5), 2488.25);
  assert.equal(applyCatalogBrochureDiscount(100, 100), 0);
  assert.equal(applyCatalogBrochureFixedDiscount(2690, 250), 2440);
  assert.equal(applyCatalogBrochureFixedDiscount(100, 250), 0);
});

test("calculates product pages for both brochure layouts", () => {
  assert.equal(catalogBrochureProductPageCount(0, "single"), 0);
  assert.equal(catalogBrochureProductPageCount(3, "single"), 3);
  assert.equal(catalogBrochureProductPageCount(3, "double"), 2);
  assert.equal(catalogBrochureProductPageCount(4, "double"), 2);
});

test("upgrades legacy HTTP supplier images only for known hosts", () => {
  assert.deepEqual(
    catalogImageSources(["http://cdn.shopify.com/image.jpg", "http://unknown.example/image.jpg"]),
    ["https://cdn.shopify.com/image.jpg"]
  );
});
