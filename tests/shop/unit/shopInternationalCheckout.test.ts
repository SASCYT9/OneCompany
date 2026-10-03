import test from "node:test";
import assert from "node:assert/strict";
import { isInternationalDelivery, validateInternationalCheckout } from "../../../src/lib/shopInternationalCheckout";

test("Ukraine checkout keeps its normal payment flow and has no international consent", () => {
  for (const country of ["Ukraine", "Україна", "UA"]) {
    assert.equal(isInternationalDelivery(country), false);
    assert.equal(validateInternationalCheckout(country, "MONOBANK", false), null);
  }
});
test("international order must be a manager request with explicit consent before any payment", () => {
  assert.equal(validateInternationalCheckout("United States", "MANAGER_QUOTE", true), null);
  assert.equal(validateInternationalCheckout("United States", "MANAGER_QUOTE", "true"), "INTERNATIONAL_DELIVERY_CONSENT_REQUIRED");
  assert.equal(validateInternationalCheckout("Germany", "MONOBANK", true), "INTERNATIONAL_DELIVERY_QUOTE_REQUIRED");
  assert.equal(validateInternationalCheckout("Ukraine", "MANAGER_QUOTE", true), "MANAGER_QUOTE_REQUIRES_INTERNATIONAL_DELIVERY");
});
