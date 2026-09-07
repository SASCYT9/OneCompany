import test from "node:test";
import assert from "node:assert/strict";
import { buildShopCatalogImportProvenance } from "../../../src/lib/shopCatalogImportProvenance";
import { flattenShopCatalogRawPayload } from "../../../src/lib/shopCatalogSourceCoverage";

test("maps nested repeated variant leaves by path-local ordinal", () => {
  const rawPayload = {
    product: {
      title: "Product",
      variants: [
        { id: "external-a", selectedOptions: [{ name: "Size", value: "S" }], sku: "A" },
        {
          id: "external-b",
          selectedOptions: [
            { name: "Size", value: "M" },
            { name: "Color", value: "Red" },
          ],
          sku: "B",
        },
      ],
    },
    tags: ["one", "two"],
  };
  const rows = buildShopCatalogImportProvenance({
    rawPayload,
    productId: "product-1",
    variantIds: new Map([
      ["external-a", "variant-a"],
      ["external-b", "variant-b"],
    ]),
    mapperVersion: "test-v1",
    sourceRecordId: "record-1",
  });
  const selectedValues = rows.filter((row) => row.canonicalField === "selectedOptions.value");
  assert.deepEqual(
    selectedValues.map((row) => [row.ordinal, row.variantId, row.rawValue]),
    [
      [0, "variant-a", "S"],
      [1, "variant-b", "M"],
      [2, "variant-b", "Red"],
    ]
  );
  assert.equal(rows.filter((row) => row.canonicalEntityType === "PRODUCT").length > 0, true);
  assert.equal(rows.length, flattenShopCatalogRawPayload(rawPayload).length);
});

test("reordered external mapping changes owners without using array ordinal as id", () => {
  const rawPayload = {
    product: {
      variants: [
        { id: "a", code: "A" },
        { id: "b", code: "B" },
      ],
    },
  };
  const rows = buildShopCatalogImportProvenance({
    rawPayload,
    productId: "p",
    variantIds: new Map([
      ["a", "canonical-b"],
      ["b", "canonical-a"],
    ]),
    mapperVersion: "v",
    sourceRecordId: "r",
  });
  assert.deepEqual(
    rows.filter((row) => row.canonicalField === "code").map((row) => row.variantId),
    ["canonical-b", "canonical-a"]
  );
});

test("empty variants and optional fields remain product-owned", () => {
  const rawPayload = { product: { variants: [] }, note: null };
  const rows = buildShopCatalogImportProvenance({
    rawPayload,
    productId: "p",
    variantIds: new Map(),
    mapperVersion: "v",
    sourceRecordId: "r",
  });
  assert.ok(
    rows.every((row) => row.canonicalEntityType === "PRODUCT" && row.canonicalEntityId === "p")
  );
  assert.equal(rows.length, flattenShopCatalogRawPayload(rawPayload).length);
});

test("rejects missing external id or canonical variant binding", () => {
  assert.throws(
    () =>
      buildShopCatalogImportProvenance({
        rawPayload: { product: { variants: [{ code: "A" }] } },
        productId: "p",
        variantIds: new Map(),
        mapperVersion: "v",
        sourceRecordId: "r",
      }),
    /missing an external id/
  );
  assert.throws(
    () =>
      buildShopCatalogImportProvenance({
        rawPayload: { product: { variants: [{ id: "a", code: "A" }] } },
        productId: "p",
        variantIds: new Map(),
        mapperVersion: "v",
        sourceRecordId: "r",
      }),
    /Missing canonical binding/
  );
});
