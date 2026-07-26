import assert from "node:assert/strict";
import test from "node:test";
import { calculateStructuredQuote, normalizeBrandKey } from "../../../src/lib/quoteKnowledge";

test("normalizes brand names to stable knowledge keys", () => {
  assert.equal(normalizeBrandKey("RW Carbon"), "rw-carbon");
});

test("RW Carbon retail formula fails closed without international shipping", () => {
  assert.deepEqual(
    calculateStructuredQuote({
      brandKey: "rw-carbon",
      mode: "RETAIL",
      productPriceMinor: 100_000,
      localShippingMinor: 5_000,
      taxMinor: 0,
      currency: "USD",
    }),
    {
      status: "NEEDS_INPUT",
      missingFields: ["internationalShippingMinor"],
      currency: "USD",
      formulaVersion: "rw-carbon-retail-v1",
    }
  );
});

test("RW Carbon retail formula uses exact integer components", () => {
  const result = calculateStructuredQuote({
    brandKey: "rw-carbon",
    mode: "RETAIL",
    productPriceMinor: 100_000,
    localShippingMinor: 5_000,
    taxMinor: 8_000,
    internationalShippingMinor: 20_000,
    currency: "USD",
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.finalMinor, 148_000);
  assert.equal(result.formulaVersion, "rw-carbon-retail-v1");
});

test("unapproved wholesale formula never calculates", () => {
  const result = calculateStructuredQuote({
    brandKey: "rw-carbon",
    mode: "WHOLESALE",
    productPriceMinor: 100_000,
    localShippingMinor: 5_000,
    taxMinor: 0,
    internationalShippingMinor: 20_000,
    currency: "USD",
  });
  assert.equal(result.status, "NEEDS_INPUT");
  assert.deepEqual(result.missingFields, ["wholesaleFormulaApproval"]);
});
