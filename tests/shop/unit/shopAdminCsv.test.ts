import test from "node:test";
import assert from "node:assert/strict";
import { buildProductsFromShopifyCsv } from "../../../src/lib/shopAdminCsv";

const SOURCE_CSV = [
  [
    "Model Handle",
    "Model Title",
    "Body (HTML)",
    "Vendor",
    "Type",
    "Tags",
    "Published",
    "Option1 Name",
    "Option1 Value",
    "Variant SKU",
    "Variant Grams",
    "Variant Inventory Qty",
    "Variant Inventory Policy",
    "Variant Fulfillment Service",
    "Variant Price",
    "Variant Compare At Price",
    "Image Src",
  ].join(","),
  [
    "urban-range-rover-kit",
    "Urban Range Rover Kit",
    '"<p>Full carbon body kit</p>"',
    "Urban Automotive",
    "Body Kit",
    '"urban,range-rover"',
    "TRUE",
    "Finish",
    "Gloss",
    "URB-RR-001",
    "0",
    "4",
    "deny",
    "manual",
    "45000",
    "47000",
    "https://cdn.example.com/range-rover.jpg",
  ].join(","),
].join("\n");

test("CSV builder supports template-driven header remapping", () => {
  const result = buildProductsFromShopifyCsv(SOURCE_CSV, {
    "Model Handle": "Handle",
    "Model Title": "Title",
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.products.length, 1);
  assert.equal(result.productRows[0]?.rowNumber, 2);
  assert.equal(result.products[0]?.slug, "urban-range-rover-kit");
  assert.equal(result.products[0]?.titleEn, "Urban Range Rover Kit");
  assert.equal(result.products[0]?.variants[0]?.inventoryPolicy, "DENY");
});

test("CSV builder does not turn image-only rows into variants", () => {
  const csv = [
    "Handle,Title,Published,Status,Option1 Name,Option1 Value,Variant SKU,Variant Price,Image Src,Image Position",
    "eventuri-test,Eventuri Test,true,active,Title,Default Title,EVE-TEST,12000,https://cdn.example.com/one.jpg,1",
    "eventuri-test,,,,,,,,https://cdn.example.com/two.jpg,2",
  ].join("\n");
  const result = buildProductsFromShopifyCsv(csv);

  assert.equal(result.products.length, 1);
  assert.equal(result.variantsCount, 1);
  assert.equal(result.products[0]?.variants.length, 1);
  assert.deepEqual(result.products[0]?.gallery, [
    "https://cdn.example.com/one.jpg",
    "https://cdn.example.com/two.jpg",
  ]);
});

test("CSV builder keeps Shopify draft, archived, and unlisted products hidden", () => {
  for (const [sourceStatus, expectedStatus] of [
    ["draft", "DRAFT"],
    ["unlisted", "DRAFT"],
    ["archived", "ARCHIVED"],
  ] as const) {
    const csv = [
      "Handle,Title,Published,Status,Variant SKU,Variant Price",
      `eventuri-${sourceStatus},Eventuri ${sourceStatus},true,${sourceStatus},EVE-${sourceStatus},100`,
    ].join("\n");
    const product = buildProductsFromShopifyCsv(csv).products[0];
    assert.equal(product?.status, expectedStatus);
    assert.equal(product?.isPublished, false);
  }
});

test("CSV builder preserves repeated SKUs as separate product applications", () => {
  const csv = [
    "Handle,Title,Published,Status,Vendor,Make,Carmodel,Variant SKU,Variant Price,Image Src",
    "eventuri-bmw-m3,Eventuri BMW M3,true,active,Eventuri,BMW,M3,EVE-SHARED-INT,1000,https://cdn.example.com/m3.jpg",
    "eventuri-bmw-m4,Eventuri BMW M4,true,active,Eventuri,BMW,M4,EVE-SHARED-INT,1000,https://cdn.example.com/m4.jpg",
  ].join("\n");
  const result = buildProductsFromShopifyCsv(csv);

  assert.equal(result.products.length, 2);
  assert.equal(result.variantsCount, 2);
  assert.deepEqual(
    result.products.map((product) => product.variants[0]?.sku),
    ["EVE-SHARED-INT", "EVE-SHARED-INT"]
  );
  assert.deepEqual(
    result.products.map((product) => product.slug),
    ["eventuri-bmw-m3", "eventuri-bmw-m4"]
  );
});

test("CSV builder preserves zero prices and missing vehicle fields for downstream gates", () => {
  const csv = [
    "Handle,Title,Published,Status,Vendor,Variant SKU,Variant Price,Image Src",
    "eventuri-no-fitment,Eventuri accessory,true,active,Eventuri,EVE-NO-FITMENT,0,https://cdn.example.com/accessory.jpg",
  ].join("\n");
  const result = buildProductsFromShopifyCsv(csv);
  const product = result.products[0];

  assert.equal(product?.variants[0]?.priceUah, 0);
  assert.equal(product?.priceUah, 0);
  assert.equal(product?.vendor, "Eventuri");
  assert.equal(product?.collectionUa, null);
});
