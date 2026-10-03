import test from "node:test";
import assert from "node:assert/strict";
import { googleProductAvailability } from "../../../src/lib/shopGoogleAvailability";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { ShopProductStructuredData } from "../../../src/components/seo/StructuredData";

test("stock and already released items on order use the proper Google values", () => {
  assert.equal(googleProductAvailability("inStock").availability, "in_stock");
  assert.equal(googleProductAvailability("preOrder").availability, "backorder");
  assert.equal(googleProductAvailability("preOrder").availabilityDate, null);
});

test("Google structured data uses confirmed stock for both availability and delivery date", () => {
  for (const [stock, resolvedStock] of [["preOrder", "inStock"], ["inStock", "preOrder"]] as const) {
    const product = { slug: "synthetic-stock-product", sku: "SYNTHETIC-STOCK", brand: "Urban Automotive",
      title: { ua: "Тест", en: "Test" }, category: { ua: "Деталі", en: "Parts" }, stock,
      shortDescription: { ua: "Тест", en: "Test" }, longDescription: { ua: "Тест", en: "Test" },
      price: { uah: 100 }, availabilityDate: "2026-11-03",
      storefrontDisplay: { availability: resolvedStock, showInStock: resolvedStock === "inStock", showInCarousel: false } } as unknown as ShopProduct;
    const rendered = renderToStaticMarkup(createElement(ShopProductStructuredData, { product, locale: "ua" }));
    const schema = JSON.parse(rendered.match(/<script[^>]*>(.*?)<\/script>/)![1]);
    for (const offer of Array.isArray(schema.offers) ? schema.offers : [schema.offers]) {
      assert.equal(offer.availability, resolvedStock === "inStock" ? "https://schema.org/InStock" : "https://schema.org/BackOrder");
      assert.equal(offer.availabilityStarts, resolvedStock === "inStock" ? undefined : "2026-11-03T00:00:00Z");
    }
  }
});
test("availability date is emitted only from an explicit valid source date", () => {
  assert.equal(googleProductAvailability("preOrder", "2026-11-03").availabilityDate, "2026-11-03T00:00:00Z");
  assert.equal(googleProductAvailability("preOrder", "2026-02-30").availabilityDate, null);
  assert.equal(googleProductAvailability("preOrder", "4 weeks").availabilityDate, null);
  assert.equal(googleProductAvailability("preOrder", "2026-11-03T25:00:00Z").availabilityDate, null);
  assert.equal(googleProductAvailability("preOrder", "2026-11-03T12:30:00Z").availabilityDate, "2026-11-03T12:30:00Z");
});
