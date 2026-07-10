import test from "node:test";
import assert from "node:assert/strict";
import {
  assessShopProductSeo,
  isPublishedActiveSitemapCandidate,
  normalizeSeoTitleKey,
  type ShopSeoAuditProduct,
} from "../../../src/lib/shopSeoAudit";

const completeProduct: ShopSeoAuditProduct = {
  slug: "akrapovic-example",
  sku: "S-EXAMPLE",
  brand: "Akrapovic",
  status: "ACTIVE",
  isPublished: true,
  titleUa: "Вихлопна система Akrapovic",
  titleEn: "Akrapovic Exhaust System",
  categoryUa: "Вихлопні системи",
  categoryEn: "Exhaust Systems",
  shortDescUa: "Опис українською",
  shortDescEn: "English description",
  longDescUa: null,
  longDescEn: null,
  bodyHtmlUa: null,
  bodyHtmlEn: null,
  image: "https://example.com/product.jpg",
  priceEur: 1000,
  priceEurEurope: null,
  priceUsd: null,
  priceUah: null,
  pricedVariants: [],
};

test("complete active product has no SEO quality issues", () => {
  assert.deepEqual(assessShopProductSeo(completeProduct), []);
  assert.equal(isPublishedActiveSitemapCandidate(completeProduct), true);
});

test("variant price satisfies the price quality signal", () => {
  const product = {
    ...completeProduct,
    priceEur: null,
    pricedVariants: [{ id: "variant-1" }],
  };
  assert.equal(assessShopProductSeo(product).includes("missing-price"), false);
});

test("draft published product is reported but not considered a sitemap candidate", () => {
  const product = { ...completeProduct, status: "DRAFT" as const };
  assert.deepEqual(assessShopProductSeo(product), ["not-active"]);
  assert.equal(isPublishedActiveSitemapCandidate(product), false);
});

test("title normalization finds punctuation and casing duplicates", () => {
  assert.equal(normalizeSeoTitleKey("BMW B48 — Blow-Off Valve!"), "bmw b48 blow off valve");
  assert.equal(normalizeSeoTitleKey("bmw b48 blow off valve"), "bmw b48 blow off valve");
});
