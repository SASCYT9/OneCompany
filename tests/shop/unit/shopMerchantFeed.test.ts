import test from "node:test";
import assert from "node:assert/strict";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { buildMerchantFeedItemXml, escapeXml } from "../../../src/lib/shopMerchantFeed";

const rates = { EUR: 1, USD: 1.1, UAH: 45 };

function makeProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    slug: "remus-bundle-1-950020-1002-30",
    sku: "1-950020-1002-30",
    scope: "auto",
    brand: "Remus",
    title: { ua: "Вихлопна система Remus", en: "Remus exhaust system" },
    category: { ua: "Вихлоп", en: "Exhaust" },
    shortDescription: { ua: "Опис & деталі", en: "Description & details" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 2000, usd: 0, uah: 0 },
    image: "/images/remus.jpg",
    highlights: [],
    ...overrides,
  };
}

test("feed link is the canonical storefront URL used by the sitemap and page", () => {
  const xml = buildMerchantFeedItemXml(makeProduct(), "en", "EUR", rates);
  assert.match(
    xml,
    /<link>https:\/\/onecompany\.global\/en\/shop\/remus-bundle-1-950020-1002-30<\/link>/
  );

  const racechip = buildMerchantFeedItemXml(
    makeProduct({ slug: "racechip-gts5-audi-a4", brand: "RaceChip", sku: "RC-1" }),
    "ua",
    "EUR",
    rates
  );
  assert.match(
    racechip,
    /<link>https:\/\/onecompany\.global\/ua\/shop\/racechip\/products\/racechip-gts5-audi-a4<\/link>/
  );
});

test("brand plus MPN is not flagged as having no identifier", () => {
  const withIds = buildMerchantFeedItemXml(makeProduct(), "en", "EUR", rates);
  assert.match(withIds, /<g:brand>Remus<\/g:brand>/);
  assert.match(withIds, /<g:mpn>1-950020-1002-30<\/g:mpn>/);
  assert.equal(withIds.includes("identifier_exists"), false);

  const withoutMpn = buildMerchantFeedItemXml(makeProduct({ sku: "" }), "en", "EUR", rates);
  assert.match(withoutMpn, /<g:identifier_exists>false<\/g:identifier_exists>/);
});

test("price is converted to the requested currency and pre-order maps to backorder", () => {
  const xml = buildMerchantFeedItemXml(makeProduct({ stock: "preOrder" }), "en", "USD", rates);
  assert.match(xml, /<g:price>2200\.00 USD<\/g:price>/);
  assert.match(xml, /<g:availability>backorder<\/g:availability>/);
});

test("items without a resolvable price or flagged as test are skipped", () => {
  assert.equal(
    buildMerchantFeedItemXml(
      makeProduct({ price: { eur: 0, usd: 0, uah: 0 } }),
      "en",
      "EUR",
      rates
    ),
    ""
  );
  assert.equal(
    buildMerchantFeedItemXml(makeProduct({ tags: ["internal-test"] }), "en", "EUR", rates),
    ""
  );
});

test("text fields are XML-escaped", () => {
  assert.equal(
    escapeXml(`a & b < c > "d" 'e'`),
    "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;"
  );
  const xml = buildMerchantFeedItemXml(makeProduct(), "en", "EUR", rates);
  assert.match(xml, /<description>Description &amp; details<\/description>/);
});
