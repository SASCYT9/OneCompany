import assert from "node:assert/strict";
import test from "node:test";
import { canUsePremiumCatalogProjection } from "../../../src/lib/shopCatalogPremiumEligibility";

test("premium projection rejects legacy-only query dimensions", () => {
  assert.equal(canUsePremiumCatalogProjection(new URLSearchParams("make=BMW")), true);
  for (const query of [
    "productType=intake",
    "productKind=turbo",
    "productKind=brakes&strict=1",
    "brand=A&brand=B",
  ]) {
    assert.equal(canUsePremiumCatalogProjection(new URLSearchParams(query)), false, query);
  }
  assert.equal(
    canUsePremiumCatalogProjection(new URLSearchParams("productKind=any&brand=A")),
    true
  );
});
