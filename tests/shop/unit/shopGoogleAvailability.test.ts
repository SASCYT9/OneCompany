import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BACKORDER_LEAD_DAYS,
  googleMerchantAvailability,
  googleProductAvailability,
  parseLeadTimeDays,
} from "../../../src/lib/shopGoogleAvailability";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { ShopProductStructuredData } from "../../../src/components/seo/StructuredData";

test("stock and already released items on order use the proper Google values", () => {
  assert.equal(googleProductAvailability("inStock").availability, "in_stock");
  assert.equal(googleProductAvailability("preOrder").availability, "backorder");
  assert.equal(googleProductAvailability("preOrder").availabilityDate, null);
});

test("Google structured data uses confirmed stock for both availability and delivery date", () => {
  for (const [stock, resolvedStock] of [
    ["preOrder", "inStock"],
    ["inStock", "preOrder"],
  ] as const) {
    const product = {
      slug: "synthetic-stock-product",
      sku: "SYNTHETIC-STOCK",
      brand: "Urban Automotive",
      title: { ua: "Тест", en: "Test" },
      category: { ua: "Деталі", en: "Parts" },
      stock,
      shortDescription: { ua: "Тест", en: "Test" },
      longDescription: { ua: "Тест", en: "Test" },
      price: { uah: 100 },
      availabilityDate: "2026-11-03",
      storefrontDisplay: {
        availability: resolvedStock,
        showInStock: resolvedStock === "inStock",
        showInCarousel: false,
      },
    } as unknown as ShopProduct;
    const rendered = renderToStaticMarkup(
      createElement(ShopProductStructuredData, { product, locale: "ua" })
    );
    const productScripts = load(rendered)(
      'script[type="application/ld+json"][id^="product-schema-"]'
    );
    assert.equal(productScripts.length, 1);
    const schema = JSON.parse(productScripts.text());
    for (const offer of Array.isArray(schema.offers) ? schema.offers : [schema.offers]) {
      assert.equal(
        offer.availability,
        resolvedStock === "inStock" ? "https://schema.org/InStock" : "https://schema.org/BackOrder"
      );
      assert.equal(
        offer.availabilityStarts,
        resolvedStock === "inStock" ? undefined : "2026-11-03T00:00:00Z"
      );
    }
  }
});
test("availability date is emitted only from an explicit valid source date", () => {
  assert.equal(
    googleProductAvailability("preOrder", "2026-11-03").availabilityDate,
    "2026-11-03T00:00:00Z"
  );
  assert.equal(googleProductAvailability("preOrder", "2026-02-30").availabilityDate, null);
  assert.equal(googleProductAvailability("preOrder", "4 weeks").availabilityDate, null);
  assert.equal(
    googleProductAvailability("preOrder", "2026-11-03T25:00:00Z").availabilityDate,
    null
  );
  assert.equal(
    googleProductAvailability("preOrder", "2026-11-03T12:30:00Z").availabilityDate,
    "2026-11-03T12:30:00Z"
  );
});

test("lead-time text is read as its upper bound in calendar days", () => {
  assert.equal(parseLeadTimeDays("4–6 тижнів"), 42);
  assert.equal(parseLeadTimeDays("30 днів"), 30);
  assert.equal(parseLeadTimeDays("1 день"), 1);
  assert.equal(parseLeadTimeDays("2-3 weeks"), 21);
  assert.equal(parseLeadTimeDays("10 days"), 10);
  assert.equal(parseLeadTimeDays("2 місяці"), 60);
  assert.equal(parseLeadTimeDays("10-14 робочих днів"), 20);
  assert.equal(parseLeadTimeDays("від 3 тижнів"), 21);
  assert.equal(parseLeadTimeDays("500 днів"), 365);
  assert.equal(parseLeadTimeDays("Під замовлення"), null);
  assert.equal(parseLeadTimeDays("By order"), null);
  assert.equal(parseLeadTimeDays(""), null);
  assert.equal(parseLeadTimeDays(null), null);
});

test("Google gets an estimated date for items on order; the storefront helper does not", () => {
  const now = new Date("2026-10-16T15:00:00Z");
  assert.equal(DEFAULT_BACKORDER_LEAD_DAYS, 21);
  // No explicit date and no usable lead time: owner-approved 21-day average.
  assert.equal(
    googleMerchantAvailability("preOrder", null, { ua: "Під замовлення", en: "By order" }, now)
      .availabilityDate,
    "2026-11-06T00:00:00Z"
  );
  // A made-to-order lead time wins over the average.
  assert.equal(
    googleMerchantAvailability("preOrder", null, { ua: "4–6 тижнів", en: "" }, now)
      .availabilityDate,
    "2026-11-27T00:00:00Z"
  );
  assert.equal(
    googleMerchantAvailability("preOrder", undefined, { ua: "", en: "8 weeks" }, now)
      .availabilityDate,
    "2026-12-11T00:00:00Z"
  );
  // An explicit supplier/manager date wins over any estimate.
  assert.equal(
    googleMerchantAvailability("preOrder", "2026-11-03", { ua: "4–6 тижнів" }, now)
      .availabilityDate,
    "2026-11-03T00:00:00Z"
  );
  // Items in stock never carry a date.
  const inStock = googleMerchantAvailability("inStock", null, { ua: "4–6 тижнів" }, now);
  assert.equal(inStock.availability, "in_stock");
  assert.equal(inStock.availabilityDate, null);
  // The storefront keeps showing a date only when an explicit one exists.
  assert.equal(googleProductAvailability("preOrder", null).availabilityDate, null);
});

test("Product structured data carries the estimated date for items on order", () => {
  const product = {
    slug: "synthetic-backorder-product",
    sku: "SYNTHETIC-BACKORDER",
    brand: "KW Suspensions",
    title: { ua: "Тест", en: "Test" },
    category: { ua: "Деталі", en: "Parts" },
    stock: "preOrder",
    shortDescription: { ua: "Тест", en: "Test" },
    longDescription: { ua: "Тест", en: "Test" },
    leadTime: { ua: "Під замовлення", en: "By order" },
    price: { uah: 100 },
  } as unknown as ShopProduct;
  const rendered = renderToStaticMarkup(
    createElement(ShopProductStructuredData, { product, locale: "ua" })
  );
  const schema = JSON.parse(
    load(rendered)('script[type="application/ld+json"][id^="product-schema-"]').text()
  );
  const expected = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const offer of Array.isArray(schema.offers) ? schema.offers : [schema.offers]) {
    assert.equal(offer.availability, "https://schema.org/BackOrder");
    assert.equal(offer.availabilityStarts, `${expected}T00:00:00Z`);
  }
});
