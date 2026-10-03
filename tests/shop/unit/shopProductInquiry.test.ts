import test from "node:test";
import assert from "node:assert/strict";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { buildProductInquiryHref, resolveProductInquiry, productInquiryMessage } from "../../../src/lib/shopProductInquiry";

const product = { id: "p1", slug: "urban-decal", sku: "PARENT", brand: "Urban Automotive", scope: "auto", title: { ua: "Декалі Urban", en: "Urban decals" }, variants: [{ id: "v1", sku: "URB-DEC-26009343-V1", title: "Black" }] } as unknown as ShopProduct;

test("product request preserves the selected variant and canonical SKU for the manager", () => {
  const context = resolveProductInquiry(product, "ua", "v1");
  assert.equal(context.productId, "p1");
  assert.equal(context.sku, "URB-DEC-26009343-V1");
  assert.match(productInquiryMessage(context, "ua"), /Товар: Декалі Urban\nSKU: URB-DEC-26009343-V1/);
  assert.match(productInquiryMessage(context, "en"), /Product: Декалі Urban/);
  assert.equal(buildProductInquiryHref("en", "a&b", "v+1"), "/en/contact?product=a%26b&variant=v%2B1");
});

test("unknown variant cannot silently become an inquiry about the parent product", () => {
  assert.throws(() => resolveProductInquiry(product, "en", "another-product-variant"), /INQUIRY_VARIANT_NOT_FOUND/);
  assert.equal(resolveProductInquiry(product, "en").title, "Urban decals");
});
