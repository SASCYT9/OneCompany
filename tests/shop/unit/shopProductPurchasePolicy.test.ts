import test from "node:test";
import assert from "node:assert/strict";
import { requiresUrbanBodyKitQuote } from "../../../src/lib/shopProductPurchasePolicy";

test("decal pack has one policy on both SKU and canonical URL, without blocking other Urban parts", () => {
  assert.equal(requiresUrbanBodyKitQuote({ sku: "URB-DEC-26009343-V1" }), true);
  assert.equal(requiresUrbanBodyKitQuote({ slug: "urb-dec-26009343-v1" }), true);
  assert.equal(requiresUrbanBodyKitQuote({ sku: "URB-SPO-25353093-V1" }), false);
});
