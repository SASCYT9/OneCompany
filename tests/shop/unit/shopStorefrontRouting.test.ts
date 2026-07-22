import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShopStorefrontProductPath,
  resolveShopCatalogProductHref,
  resolveShopStorefrontSegment,
} from "../../../src/lib/shopStorefrontRouting";
import { SHOP_PRODUCT_LEGACY_PREFIX_ROUTES } from "../../../src/lib/storefrontRouteRegistry";

test("resolveShopStorefrontSegment prioritizes explicit Urban and Brabus store tags", () => {
  assert.equal(resolveShopStorefrontSegment({ tags: ["store:urban"] }), "urban");
  assert.equal(resolveShopStorefrontSegment({ tags: ["store:brabus"] }), "brabus");
});

test("resolveShopStorefrontSegment keeps store:main products out of Urban and Brabus storefronts", () => {
  assert.equal(
    resolveShopStorefrontSegment({
      brand: "Urban Automotive",
      vendor: "Urban Automotive",
      tags: ["store:main"],
    }),
    null
  );
  assert.equal(
    buildShopStorefrontProductPath("ua", {
      slug: "urb-part",
      brand: "Urban Automotive",
      vendor: "Urban Automotive",
      tags: ["store:main"],
    }),
    "/ua/shop/urb-part"
  );
});

test("buildShopStorefrontProductPath still supports legacy brand storefront routing when no store tag exists", () => {
  assert.equal(
    buildShopStorefrontProductPath("ua", {
      slug: "akr-slip-on",
      brand: "Akrapovic",
    }),
    "/ua/shop/akrapovic/products/akr-slip-on"
  );
});

test("buildShopStorefrontProductPath resolves iPE aliases to the ipe storefront", () => {
  assert.equal(
    buildShopStorefrontProductPath("ua", {
      slug: "ipe-system",
      brand: "iPE exhaust",
    }),
    "/ua/shop/ipe/products/ipe-system"
  );

  assert.equal(
    resolveShopStorefrontSegment({
      vendor: "Innotech Performance Exhaust",
    }),
    "ipe"
  );
});

test("legacy product prefixes are unique and cover every canonical storefront route", () => {
  const prefixes = SHOP_PRODUCT_LEGACY_PREFIX_ROUTES.map((route) => route.prefix);
  assert.equal(prefixes.length, 13);
  assert.equal(new Set(prefixes).size, prefixes.length);

  assert.deepEqual(
    Object.fromEntries(
      SHOP_PRODUCT_LEGACY_PREFIX_ROUTES.map((route) => [route.prefix, route.segment])
    ),
    {
      "racechip-": "racechip",
      "do88-": "do88",
      "brabus-": "brabus",
      "girodisc-": "girodisc",
      "burger-": "burger",
      "ohlins-": "ohlins",
      "akrapovic-": "akrapovic",
      "ducati-akrapovic-": "akrapovic",
      "ilmberger-": "ilmberger",
      "csf-": "csf",
      "urb-": "urban",
      "adro-": "adro",
      "ipe-": "ipe",
    }
  );
});

test("all routed brands produce long canonical product paths", () => {
  const samples = [
    ["Brabus", "brabus"],
    ["GiroDisc", "girodisc"],
    ["Ohlins", "ohlins"],
    ["Akrapovic", "akrapovic"],
    ["Ilmberger Carbon", "ilmberger"],
    ["CSF", "csf"],
  ] as const;

  for (const [brand, segment] of samples) {
    assert.equal(
      buildShopStorefrontProductPath("en", { slug: `${segment}-sample`, brand }),
      `/en/shop/${segment}/products/${segment}-sample`
    );
  }
});

test("catalog product links prefer safe canonical storefront hrefs", () => {
  assert.equal(
    resolveShopCatalogProductHref("ua", "/ua/shop/akrapovic/products/akr-slip-on", "akr-slip-on"),
    "/ua/shop/akrapovic/products/akr-slip-on"
  );
});

test("catalog product links fall back safely for missing or unexpected hrefs", () => {
  assert.equal(
    resolveShopCatalogProductHref("en", undefined, "ipe system"),
    "/en/shop/ipe%20system"
  );
  assert.equal(
    resolveShopCatalogProductHref("ua", "/en/shop/ipe/products/ipe-system", "ipe-system"),
    "/ua/shop/ipe-system"
  );
  assert.equal(
    resolveShopCatalogProductHref("ua", "https://example.com/product", "safe-product"),
    "/ua/shop/safe-product"
  );
  assert.equal(resolveShopCatalogProductHref("ua", "javascript:alert(1)", ""), "/ua/shop");
});
