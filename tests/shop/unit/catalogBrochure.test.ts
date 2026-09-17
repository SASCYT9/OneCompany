import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCatalogBrochureDiscount,
  applyCatalogBrochureFixedDiscount,
  catalogBrochureContentDisposition,
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
  assert.equal(
    validateCatalogBrochureRequest({
      ...validRequest,
      items: [
        {
          productId: "product-1",
          imageSources: [
            "https://cdn.example.com/detail.jpg",
            "https://cdn.example.com/product.jpg",
          ],
          galleryLayout: "feature",
        },
      ],
    }),
    null
  );
});

test("accepts gallery and description presentation modes", () => {
  assert.equal(
    validateCatalogBrochureRequest({
      ...validRequest,
      photoMode: "gallery",
      descriptionMode: "short",
    }),
    null
  );
  assert.equal(
    validateCatalogBrochureRequest({
      ...validRequest,
      photoMode: "hero",
      descriptionMode: "none",
    }),
    null
  );

  const invalidPhotoMode = validateCatalogBrochureRequest({
    ...validRequest,
    photoMode: "carousel",
  });
  assert.match(invalidPhotoMode ?? "", /фотографій/i);

  const invalidDescriptionMode = validateCatalogBrochureRequest({
    ...validRequest,
    descriptionMode: "verbose",
  });
  assert.match(invalidDescriptionMode ?? "", /описів/i);
});

test("accepts page editing, image framing, and client personalization", () => {
  assert.equal(
    validateCatalogBrochureRequest({
      ...validRequest,
      clientName: "Сергій",
      clientCompany: "Urban Motors",
      managerName: "Олександр",
      managerPhone: "+380 00 000 00 00",
      managerEmail: "manager@example.com",
      personalNote: "Персональна конфігурація для вашого автомобіля.",
      validUntil: "2026-12-31",
      showContactPage: true,
      items: [
        {
          productId: "product-1",
          pageTemplate: "gallery",
          descriptionMode: "custom",
          titleOverride: "Персональна назва",
          descriptionOverride: "Скорочений опис для презентації.",
          showSku: false,
          showBrand: true,
          showPrice: true,
          imageSources: ["https://cdn.example.com/product.jpg"],
          imageEdits: [
            {
              source: "https://cdn.example.com/product.jpg",
              fit: "cover",
              focusX: 42,
              focusY: 58,
              zoom: 1.25,
            },
          ],
        },
      ],
    }),
    null
  );
});

test("rejects invalid page image framing", () => {
  const error = validateCatalogBrochureRequest({
    ...validRequest,
    items: [
      {
        productId: "product-1",
        imageSources: ["https://cdn.example.com/product.jpg"],
        imageEdits: [
          {
            source: "https://cdn.example.com/product.jpg",
            fit: "cover",
            focusX: 101,
            focusY: 50,
            zoom: 3,
          },
        ],
      },
    ],
  });
  assert.match(error ?? "", /кадрування/i);
});

test("rejects malformed product photo overrides", () => {
  const error = validateCatalogBrochureRequest({
    ...validRequest,
    items: [{ productId: "product-1", imageSource: "https://cdn.example.com/bad\nphoto.jpg" }],
  });
  assert.ok(error);
  assert.match(error, /фото/i);

  const emptyGallery = validateCatalogBrochureRequest({
    ...validRequest,
    items: [{ productId: "product-1", imageSources: [] }],
  });
  assert.match(emptyGallery ?? "", /фото/i);

  const duplicateGallery = validateCatalogBrochureRequest({
    ...validRequest,
    items: [
      {
        productId: "product-1",
        imageSources: [
          "https://cdn.example.com/product.jpg",
          "https://cdn.example.com/product.jpg",
        ],
      },
    ],
  });
  assert.match(duplicateGallery ?? "", /унікальних фото/i);

  const invalidLayout = validateCatalogBrochureRequest({
    ...validRequest,
    items: [{ productId: "product-1", galleryLayout: "masonry" }],
  });
  assert.match(invalidLayout ?? "", /розкладку фото/i);
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

test("converts a missing brochure currency from an available price", () => {
  const rates = { UAH: 1, USD: 40, EUR: 45 } as const;
  assert.equal(catalogBrochurePrice({ priceEur: null, priceUsd: 100 }, "EUR", rates), 88.89);
  assert.equal(catalogBrochurePrice({ priceEur: null, priceUah: 4500 }, "EUR", rates), 100);
  assert.equal(catalogBrochurePrice({ priceEur: null }, "EUR", rates), null);
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

test("creates a ByteString-safe PDF filename for localized titles", () => {
  const header = catalogBrochureContentDisposition("Нова конфігурація / Eventuri");
  assert.match(header, /^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
  assert.ok(!/[\u0080-\uFFFF]/.test(header));
  assert.match(header, /catalog-%D0%9D%D0%BE%D0%B2%D0%B0/);
});

test("upgrades legacy HTTP supplier images only for known hosts", () => {
  assert.deepEqual(
    catalogImageSources(["http://cdn.shopify.com/image.jpg", "http://unknown.example/image.jpg"]),
    ["https://cdn.shopify.com/image.jpg"]
  );
});
