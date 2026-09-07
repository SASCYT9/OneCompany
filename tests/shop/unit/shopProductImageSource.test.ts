import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildShopProductImageSrcSet,
  resolveShopProductImageSrc,
  ShopProductImage,
} from "../../../src/components/shop/ShopProductImage";

test("Shopify product images use bounded CDN responsive variants without Vercel transforms", () => {
  const html = renderToStaticMarkup(
    createElement(ShopProductImage, {
      src: "https://cdn.shopify.com/s/files/1/asset/image.jpg",
      alt: "Product",
      fill: true,
      sizes: "(max-width: 768px) 100vw, 25vw",
    })
  );
  assert.match(html, /srcSet="[^"]*width=320[^"]*320w/);
  assert.match(html, /width=1920/);
  assert.match(html, /sizes="\(max-width: 768px\) 100vw, 25vw"/);
  assert.match(html, /loading="lazy"/);
  assert.doesNotMatch(html, /_next\/image/);
});

test("Shopify gallery variants add only a bounded width parameter", () => {
  assert.equal(
    resolveShopProductImageSrc("https://cdn.shopify.com/s/files/1/asset/image.jpg", 240),
    "https://cdn.shopify.com/s/files/1/asset/image.jpg?width=240"
  );
  assert.equal(
    resolveShopProductImageSrc(
      "https://cdn.shopify.com/s/files/1/asset/image.jpg?crop=center",
      480
    ),
    "https://cdn.shopify.com/s/files/1/asset/image.jpg?crop=center&width=480"
  );
});

test("unknown supplier hosts and full-size sources are unchanged", () => {
  const source = "https://images.example.test/product.jpg?token=abc";
  assert.equal(resolveShopProductImageSrc(source, 240), source);
  assert.equal(resolveShopProductImageSrc("/images/product.jpg", 240), "/images/product.jpg");
  assert.equal(
    resolveShopProductImageSrc("https://cdn.shopify.com/image.jpg", 0),
    "https://cdn.shopify.com/image.jpg"
  );
  assert.equal(
    resolveShopProductImageSrc("https://cdn.shopify.com/image.jpg", Number.POSITIVE_INFINITY),
    "https://cdn.shopify.com/image.jpg"
  );
  assert.match(
    buildShopProductImageSrcSet("https://cdn.shopify.com/image.jpg", [640, 1200, 5000]) ?? "",
    /640w/
  );
  assert.match(
    buildShopProductImageSrcSet("https://cdn.shopify.com/image.jpg", [640, 1200, 5000]) ?? "",
    /2400w/
  );
  assert.equal(buildShopProductImageSrcSet(source, [640, 1200]), undefined);
});

test("signed Shopify paths and unknown query parameters are never rewritten", () => {
  for (const parameter of ["signature=abc", "token=abc", "X-Amz-Signature=abc", "custom=abc"]) {
    const source = `https://cdn.shopify.com/image_df5ca99f-8380-4135-933b-e97001d981ce.jpg?${parameter}`;
    assert.equal(resolveShopProductImageSrc(source, 240), source);
    assert.equal(buildShopProductImageSrcSet(source, [240, 1200]), undefined);
  }
});

test("srcset descriptors are positive, finite, unique and agree with URL widths", () => {
  const srcset = buildShopProductImageSrcSet("https://cdn.shopify.com/image.jpg?width=240", [
    0.1,
    240,
    240,
    9000,
    8000,
    -1,
    NaN,
    Infinity,
  ]);
  assert.ok(srcset);
  const candidates = srcset.split(", ");
  assert.equal(candidates.length, 3);
  for (const candidate of candidates) {
    const [url, descriptor] = candidate.split(" ");
    const width = Number(descriptor.slice(0, -1));
    assert.ok(width >= 1 && width <= 2400);
    assert.equal(new URL(url).searchParams.get("width"), String(width));
  }
});
