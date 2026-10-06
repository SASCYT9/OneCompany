import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveShopProductPricing } from "../../../src/lib/shopPricingAudience";
import {
  projectShopRelatedProduct,
  type ShopRelatedProductRow,
} from "../../../src/lib/shopRelatedProducts";

function row(overrides: Partial<ShopRelatedProductRow> = {}): ShopRelatedProductRow {
  return {
    id: "p-1",
    slug: "bmw-m5-exhaust",
    sku: "SKU-1",
    scope: "auto",
    brand: "Burger Motorsports",
    vendor: "Burger Motorsports",
    productType: "Exhaust",
    tags: ["vehicle:bmw"],
    titleUa: "Вихлоп BMW M5",
    titleEn: "BMW M5 Exhaust",
    categoryUa: "Вихлопні системи",
    categoryEn: "Exhaust systems",
    collectionUa: "BMW",
    collectionEn: "BMW",
    stock: "inStock",
    priceEur: "1200.50",
    priceEurEurope: "1100.25",
    priceUsd: 1300,
    priceUah: 52000,
    priceEurB2b: 1000,
    priceUsdB2b: 1100,
    priceUahB2b: 44000,
    compareAtEur: 1400,
    compareAtUsd: 1500,
    compareAtUah: 60000,
    compareAtEurB2b: 1200,
    compareAtUsdB2b: 1300,
    compareAtUahB2b: 52000,
    image: "https://cdn.example.test/product.webp",
    ...overrides,
  };
}

test("related projection preserves card identity, fitment tokens and price bands", () => {
  const product = projectShopRelatedProduct(row());

  assert.equal(product.slug, "bmw-m5-exhaust");
  assert.equal(product.brand, "Burger Motorsports");
  assert.deepEqual(product.title, { ua: "Вихлоп BMW M5", en: "BMW M5 Exhaust" });
  assert.deepEqual(product.category, {
    ua: "Вихлопні системи",
    en: "Exhaust systems",
  });
  assert.deepEqual(product.price, { eur: 1200.5, usd: 1300, uah: 52000 });
  assert.deepEqual(product.europePrice, { eur: 1100.25, usd: 0, uah: 0 });
  assert.deepEqual(product.b2bPrice, { eur: 1000, usd: 1100, uah: 44000 });
  assert.deepEqual(product.compareAt, { eur: 1400, usd: 1500, uah: 60000 });
  assert.deepEqual(product.tags, ["vehicle:bmw"]);
});

test("related projection has no heavy PDP relations", () => {
  const product = projectShopRelatedProduct(row());

  assert.equal(product.gallery, undefined);
  assert.equal(product.variants, undefined);
  assert.equal(product.externalVideos, undefined);
  assert.deepEqual(product.shortDescription, { ua: "", en: "" });
  assert.deepEqual(product.longDescription, { ua: "", en: "" });
});

test("related cards keep all source currencies and render under the active NBU price book", () => {
  const product = projectShopRelatedProduct(row({ priceSourceCurrency: "EUR", compareAtSourceCurrency: "EUR",
    b2bPriceSourceCurrency: "USD", b2bCompareAtSourceCurrency: "UAH" }));
  assert.equal(product.price.sourceCurrency, "EUR");
  assert.equal(product.compareAt?.sourceCurrency, "EUR");
  assert.equal(product.b2bPrice?.sourceCurrency, "USD");
  assert.equal(product.b2bCompareAt?.sourceCurrency, "UAH");
  const context = { customerGroup: null, customerB2BDiscountPercent: null, isAuthenticated: false,
    b2bVisibilityMode: "request_quote" as const, defaultB2BDiscountPercent: 0, priceCountry: "Ukraine",
    currencyRates: { EUR: 1, USD: 51.483 / 46.0564, UAH: 50.483, _rawUsdToUah: 45.0564, _uahReserve: 1 } };
  const pricing = resolveShopProductPricing(product, context);
  assert.equal(pricing.effectivePrice.eur, 1200.5);
  assert.equal(pricing.effectivePrice.uah, 61805.34);
  assert.equal(resolveShopProductPricing(product, { ...context, customerGroup: "B2B_APPROVED" }).effectivePrice.usd, 1100);
});

test("missing brand falls back to vendor and preserves safe stock/scope enums", () => {
  const product = projectShopRelatedProduct(
    row({ brand: null, vendor: "RaceChip", scope: "unexpected", stock: "unknown" })
  );

  assert.equal(product.brand, "RaceChip");
  assert.equal(product.scope, "auto");
  assert.equal(product.stock, "inStock");
});

test("PDP related reader is a narrow select and the page uses it", () => {
  const server = readFileSync("src/lib/shopCatalogServer.ts", "utf8");
  const start = server.indexOf("export async function getShopRelatedProductsByBrandServer");
  const end = server.indexOf("function defaultBrandMatch", start);
  assert.ok(start >= 0 && end > start);
  const reader = server.slice(start, end);
  assert.match(reader, /select:\s*\{/);
  assert.doesNotMatch(
    reader,
    /longDescUa|longDescEn|bodyHtmlUa|bodyHtmlEn|variants:|media:|bundle:/
  );

  const page = readFileSync("src/app/(strict-http)/[locale]/shop/[slug]/page.tsx", "utf8");
  assert.match(page, /getShopRelatedProductsByBrandServer\(product\.brand\)/);
  assert.doesNotMatch(page, /getShopProductsByBrandServer\(product\.brand\)/);
});

test("related Revozport cards preserve the approved delivery-pricing weight", () => {
  const product = projectShopRelatedProduct(row({ brand: "Revozport", metafields: [
    { namespace: "revozport_logistics", key: "delivery_pricing_weight_kg", value: "5.489" },
    { namespace: "revozport_logistics", key: "sea_shipping_usd", value: "49.00" },
  ] }));
  assert.equal(product.shippingPricingWeightKg, 5.489);
  assert.equal(product.shippingToUaUsd, 49);
});
