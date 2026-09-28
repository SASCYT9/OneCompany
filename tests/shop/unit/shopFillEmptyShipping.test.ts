import test from "node:test";
import assert from "node:assert/strict";

import { fillEmptyShippingValues } from "../../../src/lib/shopAdminImports";

const incoming = {
  slug: "do88-wc-420",
  sku: "WC-420",
  titleUa: "Current product title",
  weight: 10,
  length: 85,
  width: 60,
  height: 28,
  isDimensionsEstimated: true,
  variants: [{
    sku: "WC-420",
    title: "Default Title",
    weight: 10,
    weightUnit: "kg",
    length: 85,
    width: 60,
    height: 28,
    isDimensionsEstimated: true,
  }],
} as never;

test("fill-empty shipping preserves existing measured product and variant values", () => {
  const existing = {
    weight: 7.983,
    length: 76.962,
    width: 55.88,
    height: 17.018,
    isDimensionsEstimated: false,
    variants: [{
      sku: "WC-420",
      isDefault: true,
      weight: 7.983,
      weightUnit: "kg",
      length: 76.962,
      width: 55.88,
      height: 17.018,
      isDimensionsEstimated: false,
    }],
  } as never;

  const result = fillEmptyShippingValues(incoming, existing);

  assert.equal(result.error, undefined);
  assert.equal(result.fieldValuesToFill, 0);
  assert.equal(result.data.weight, 7.983);
  assert.equal(result.data.length, 76.962);
  assert.equal(result.data.width, 55.88);
  assert.equal(result.data.height, 17.018);
  assert.equal(result.data.isDimensionsEstimated, false);
  assert.equal(result.data.variants[0]?.weight, 7.983);
  assert.equal(result.data.variants[0]?.length, 76.962);
  assert.equal(result.data.variants[0]?.isDimensionsEstimated, false);
});

test("fill-empty shipping keeps known weight and fills only missing package dimensions", () => {
  const existing = {
    weight: 7.983,
    length: null,
    width: null,
    height: null,
    isDimensionsEstimated: false,
    variants: [{
      sku: "WC-420",
      isDefault: true,
      weight: 7.983,
      weightUnit: "kg",
      length: null,
      width: null,
      height: null,
      isDimensionsEstimated: false,
    }],
  } as never;

  const result = fillEmptyShippingValues(incoming, existing);

  assert.equal(result.error, undefined);
  assert.equal(result.fieldValuesToFill, 6);
  assert.equal(result.data.weight, 7.983);
  assert.equal(result.data.length, 85);
  assert.equal(result.data.width, 60);
  assert.equal(result.data.height, 28);
  assert.equal(result.data.isDimensionsEstimated, true);
  assert.equal(result.data.variants[0]?.weight, 7.983);
  assert.equal(result.data.variants[0]?.length, 85);
  assert.equal(result.data.variants[0]?.width, 60);
  assert.equal(result.data.variants[0]?.height, 28);
  assert.equal(result.data.variants[0]?.isDimensionsEstimated, true);
});

test("fill-empty shipping fails closed when a target SKU is not on the product", () => {
  const existing = { weight: null, length: null, width: null, height: null, variants: [] } as never;
  const result = fillEmptyShippingValues(incoming, existing);
  assert.match(result.error ?? "", /not present on the existing product/i);
});
