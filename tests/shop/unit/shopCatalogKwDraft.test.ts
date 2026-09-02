import assert from "node:assert/strict";
import test from "node:test";

import { buildKwCanonicalProductDraft } from "../../../src/lib/shopCatalogKwDraft";
import type { KwProductNormalization } from "../../../src/lib/shopCatalogKwNormalization";
import type { ShopifySnapshotProduct } from "../../../src/lib/shopifyCatalogSnapshot";

const normalization: KwProductNormalization = {
  externalProductId: "gid://shopify/Product/1",
  canonicalBrand: "KW Suspensions",
  categoryKey: "coilovers",
  applications: [],
  issues: [],
};

test("KW draft losslessly maps variants, regional prices, media, options and metafields", () => {
  const product: ShopifySnapshotProduct = {
    id: "gid://shopify/Product/1",
    handle: "kw-v3-bmw-g80",
    title: "KW V3 для BMW M3 G80",
    descriptionHtml: "<p>Опис</p>",
    vendor: "KW",
    productType: "Койловерна підвіска",
    status: "ACTIVE",
    updatedAt: "2026-09-02T00:00:00Z",
    seo: { title: "KW V3 BMW", description: "Підвіска KW V3" },
    tags: ["brand:BMW"],
    options: [{ id: "o1", name: "Title", position: 1, optionValues: [{ name: "Default Title" }] }],
    variants: [{ id: "v1", title: "Default Title", sku: "352200AN", price: "100000.00", inventoryQuantity: 1, inventoryPolicy: "DENY", position: 1, selectedOptions: [{ name: "Title", value: "Default Title" }] }],
    media: [{ id: "m1", mediaContentType: "IMAGE", alt: "KW V3", image: { url: "https://cdn.example/kw.jpg" } }],
    metafields: [{ id: "f1", namespace: "custom", key: "custom_price_eur", value: "2300.50", type: "number_decimal" }],
  };
  const draft = buildKwCanonicalProductDraft({
    product,
    normalization,
    enTranslations: [{ key: "title", value: "KW V3 for BMW M3 G80", outdated: false }, { key: "body_html", value: "<p>Description</p>", outdated: false }],
  });
  assert.equal(draft.product.brand, "KW Suspensions");
  assert.equal(draft.product.isPublished, false);
  assert.equal(draft.product.priceUah, "100000.00");
  assert.equal(draft.product.priceEur, "2300.50");
  assert.equal(draft.product.stock, "inStock");
  assert.equal(draft.variants[0]!.externalVariantId, "v1");
  assert.equal(draft.media[0]!.src, "https://cdn.example/kw.jpg");
  assert.equal(draft.metafields[0]!.valueType, "number_decimal");
  assert.deepEqual(draft.issues, []);
});

test("missing English content is held for review while Ukrainian source remains intact", () => {
  const product: ShopifySnapshotProduct = {
    id: "gid://shopify/Product/2", handle: "kw-test", title: "Українська назва", descriptionHtml: "<p>Опис</p>",
    vendor: "KW", status: "ACTIVE", tags: [], options: [],
    variants: [{ id: "v2", sku: "KW-2", price: "500.00", inventoryQuantity: 0, inventoryPolicy: "DENY", position: 1 }],
    media: [{ id: "m2", mediaContentType: "IMAGE", image: { url: "https://cdn.example/2.jpg" } }],
    metafields: [{ id: "f2", namespace: "custom", key: "custom_price_eur", value: "10", type: "number_decimal" }],
  };
  const draft = buildKwCanonicalProductDraft({ product, normalization });
  assert.equal(draft.product.titleUa, "Українська назва");
  assert.equal(draft.product.titleEn, "Українська назва");
  assert.equal(draft.product.isPublished, false);
  assert.ok(draft.issues.includes("title_en_missing"));
  assert.ok(draft.issues.includes("body_html_en_missing"));
});
