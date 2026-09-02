import assert from "node:assert/strict";
import test from "node:test";

import { auditShopifySnapshot, parseShopifyProductJsonl } from "../../../src/lib/shopifyCatalogSnapshot";

const product = {
  id: "gid://shopify/Product/1",
  title: "KW V3",
  vendor: "KW",
  productType: "Coilover",
  status: "ACTIVE",
  tags: ["brand:BMW", "veh:M3 (G80)", "eng:S58"],
};

test("ungrouped Shopify JSONL retains product children and unknown source fields", () => {
  const input = [
    product,
    { id: "gid://shopify/ProductVariant/2", __parentId: product.id, sku: "352200AN", price: "100.00", custom: true },
    { id: "gid://shopify/MediaImage/3", __parentId: product.id, alt: "KW V3" },
    { id: "gid://shopify/Metafield/4", __parentId: product.id, namespace: "custom", key: "fitment" },
  ].map((value) => JSON.stringify(value)).join("\n");
  const [parsed] = parseShopifyProductJsonl(input);
  assert.equal(parsed!.variants[0]!.custom, true);
  assert.equal(parsed!.media.length, 1);
  assert.equal(parsed!.metafields.length, 1);
});

test("snapshot audit is deterministic and exposes migration blockers", () => {
  const input = [
    { ...product, id: "gid://shopify/Product/1", variants: [{ sku: "DUP" }], media: [], metafields: [] },
    { ...product, id: "gid://shopify/Product/2", variants: [{ sku: "dup" }, { sku: "" }], media: [], metafields: [] },
  ];
  const report = auditShopifySnapshot(input);
  assert.equal(report.productCount, 2);
  assert.equal(report.variantCount, 3);
  assert.equal(report.missingSkuCount, 1);
  assert.deepEqual(report.duplicateSkus, ["DUP"]);
  assert.equal(report.missingMediaCount, 2);
  assert.deepEqual(report.vehicleTagCounts, { makes: 2, vehicles: 2, engines: 2 });
  assert.match(report.fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(report.fingerprint, auditShopifySnapshot([...input].reverse()).fingerprint);
});
