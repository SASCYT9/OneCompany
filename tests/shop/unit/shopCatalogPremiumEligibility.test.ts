import assert from "node:assert/strict";
import test from "node:test";
import {
  canUsePremiumCatalogProjection,
  getPremiumCatalogEligibility,
} from "../../../src/lib/shopCatalogPremiumEligibility";

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

test("premium projection gates every URL dimension whose semantics are legacy-only", () => {
  const cases = [
    ["productType=exhaust", "product_type"],
    ["productKind=downpipe", "product_kind"],
    ["strict=1", "strict"],
    ["strict=true", "strict"],
    ["facetMode=global", "facet_mode"],
    ["facetMode=unexpected", "facet_mode"],
    ["brand=Eventuri&brand=KW", "multiple_brands"],
  ] as const;

  for (const [query, reason] of cases) {
    assert.deepEqual(getPremiumCatalogEligibility(new URLSearchParams(query)), {
      eligible: false,
      reason,
    });
  }
  assert.deepEqual(
    getPremiumCatalogEligibility(
      new URLSearchParams("make=BMW&strict=0&facetMode=filtered&productKind=any&brand=BMW")
    ),
    { eligible: true, reason: "supported" }
  );
});
