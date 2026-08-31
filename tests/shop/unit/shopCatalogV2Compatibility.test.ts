import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeLegacyApplicationsToShopCatalogV2Policy,
  normalizeLegacyShopCatalogV2Query,
  SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS,
  SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
  strictMatchShopCatalogV2Compatibility,
  type ShopCatalogV2CompatibilityPolicy,
  validateShopCatalogV2CompatibilityPolicy,
} from "../../../src/lib/shopCatalogV2Compatibility";

test("ADRO can ignore engine without a brand-specific matcher", () => {
  const policy = normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId: "adro-g80-front-lip" },
    requiredDimensions: ["make", "model", "chassis"],
    dimensionDefaults: { engine: "NOT_APPLICABLE", market: "ANY" },
    verification: "VERIFIED",
    applications: [
      {
        make: "BMW",
        model: "M3",
        chassisCode: "G80",
        yearFrom: 2021,
      },
    ],
  });

  const result = strictMatchShopCatalogV2Compatibility(
    policy,
    normalizeLegacyShopCatalogV2Query({
      make: "BMW",
      model: "M3",
      chassis: "G80",
      engine: "S58",
      market: "EU",
    })
  );

  assert.deepEqual(validateShopCatalogV2CompatibilityPolicy(policy), []);
  assert.equal(result.status, "exact");
  assert.equal(
    policy.clauses[0].constraints.find((item) => item.dimension === "engine")?.state,
    "NOT_APPLICABLE"
  );
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M3", chassis: "G82" })
    ).status,
    "no_match"
  );
});

test("Eventuri applications are OR clauses whose vehicle constraints remain correlated", () => {
  const policy = normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId: "eventuri-intake-platform-policy" },
    requiredDimensions: ["make", "model", "chassis"],
    dimensionDefaults: { engine: "NOT_APPLICABLE" },
    verification: "VERIFIED",
    applications: [
      { id: "m2-f87", make: "BMW", model: "M2", chassisCode: "F87" },
      { id: "m3-g80", make: "BMW", model: "M3", chassisCode: "G80" },
    ],
  });

  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({
        make: "BMW",
        model: "M2",
        chassis: "F87",
        engine: "N55",
      })
    ).status,
    "exact"
  );
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M2", chassis: "G80" })
    ).status,
    "no_match"
  );
});

test("an engine-bound Eventuri SKU can override the platform default per product", () => {
  const policy = normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId: "eventuri-f87-m2-competition" },
    requiredDimensions: ["make", "model", "chassis", "engine"],
    verification: "VERIFIED",
    applications: [{ make: "BMW", model: "M2 Competition", chassisCode: "F87", engine: "S55" }],
  });

  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({
        make: "BMW",
        model: "M2 Competition",
        chassis: "F87",
        engine: "S55",
      })
    ).status,
    "exact"
  );
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({
        make: "BMW",
        model: "M2 Competition",
        chassis: "F87",
        engine: "N55",
      })
    ).status,
    "no_match"
  );
});

test("RaceChip requires the variant engine and fuel before returning exact", () => {
  const policy = normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId: "racechip-g87", variantId: "racechip-g87-s58-gts5" },
    requiredDimensions: ["make", "model", "chassis", "engine", "fuel"],
    verification: "VERIFIED",
    applications: [
      {
        make: "BMW",
        model: "M2",
        chassisCode: "G87",
        engine: "S58B30T0",
        fuel: "petrol",
        yearFrom: 2023,
      },
    ],
  });

  const incomplete = strictMatchShopCatalogV2Compatibility(
    policy,
    normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M2", chassis: "G87" })
  );
  assert.equal(incomplete.status, "requires_input");
  assert.deepEqual(incomplete.missingDimensions, ["engine", "fuel"]);

  const exact = strictMatchShopCatalogV2Compatibility(
    policy,
    normalizeLegacyShopCatalogV2Query({
      make: " BMW ",
      model: "M2",
      chassisCode: "g87",
      engine: "s58b30t0",
      fuel: "Petrol",
      year: 2024,
    })
  );
  assert.equal(exact.status, "exact");
  assert.deepEqual(exact.clauseIds, ["application-1"]);

  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({
        make: "BMW",
        model: "M2",
        chassis: "G87",
        engine: "B58",
        fuel: "petrol",
      })
    ).status,
    "no_match"
  );
});

test("legacy nulls normalize to UNKNOWN and can never produce an exact engine match", () => {
  const policy = normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId: "legacy-engine-unknown" },
    requiredDimensions: ["make", "model", "engine"],
    verification: "VERIFIED",
    applications: [{ make: "BMW", model: "M2", engine: null }],
  });
  const engineConstraint = policy.clauses[0].constraints.find(
    (item) => item.dimension === "engine"
  );
  assert.equal(engineConstraint?.state, "UNKNOWN");

  const result = strictMatchShopCatalogV2Compatibility(
    policy,
    normalizeLegacyShopCatalogV2Query({ make: "bmw", model: "m2", engine: "n55" })
  );
  assert.equal(result.status, "requires_verification");
  assert.deepEqual(result.unknownDimensions, ["engine"]);
});

test("inferred clauses remain review-only even when every value agrees", () => {
  const policy = normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId: "inferred-fitment" },
    requiredDimensions: ["make", "model"],
    verification: "INFERRED",
    applications: [{ make: "BMW", model: "M2" }],
  });

  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M2" })
    ).status,
    "requires_verification"
  );
});

test("explicit verified UNIVERSAL mode matches safely and cannot hide a restrictive dimension", () => {
  const universal = {
    version: SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
    mode: "UNIVERSAL",
    target: { productId: "universal-auto-accessory" },
    parentTarget: null,
    requiredDimensions: [],
    clauses: [
      {
        id: "verified-universal-auto",
        verification: "VERIFIED",
        constraints: SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.map((dimension) =>
          dimension === "scope"
            ? { dimension, state: "EXACT" as const, values: ["auto"] }
            : { dimension, state: "ANY" as const }
        ),
      },
    ],
  } satisfies ShopCatalogV2CompatibilityPolicy;

  assert.deepEqual(validateShopCatalogV2CompatibilityPolicy(universal), []);
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      universal,
      normalizeLegacyShopCatalogV2Query({
        scope: "auto",
        make: "BMW",
        model: "M2",
        chassis: "G87",
        engine: "S58",
      })
    ).status,
    "exact"
  );
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      universal,
      normalizeLegacyShopCatalogV2Query({ scope: "moto", make: "BMW" })
    ).status,
    "no_match"
  );

  const unsafeUniversal: ShopCatalogV2CompatibilityPolicy = {
    ...universal,
    clauses: [
      {
        ...universal.clauses[0],
        verification: "NEEDS_REVIEW",
        constraints: universal.clauses[0].constraints.filter(
          (constraint) => constraint.dimension !== "engine"
        ),
      },
    ],
  };
  const unsafeResult = strictMatchShopCatalogV2Compatibility(unsafeUniversal, { engine: "s58" });
  assert.equal(unsafeResult.status, "requires_verification");
  assert.ok(unsafeResult.validationErrors.some((error) => error.includes("explicitly VERIFIED")));
  assert.ok(unsafeResult.validationErrors.some((error) => error.includes("define engine")));
});

test("NEEDS_REVIEW and unresolved PARENT_DEPENDENT modes can never broaden fitment", () => {
  const needsReview: ShopCatalogV2CompatibilityPolicy = {
    version: SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
    mode: "NEEDS_REVIEW",
    target: { productId: "unclassified-accessory" },
    parentTarget: null,
    requiredDimensions: [],
    clauses: [],
  };
  const parentDependent: ShopCatalogV2CompatibilityPolicy = {
    version: SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
    mode: "PARENT_DEPENDENT",
    target: { productId: "replacement-filter" },
    parentTarget: { productId: "canonical-intake", variantId: "canonical-intake-red" },
    requiredDimensions: [],
    clauses: [],
  };

  assert.deepEqual(validateShopCatalogV2CompatibilityPolicy(needsReview), []);
  assert.deepEqual(validateShopCatalogV2CompatibilityPolicy(parentDependent), []);
  assert.equal(
    strictMatchShopCatalogV2Compatibility(needsReview, { make: "bmw" }).status,
    "requires_verification"
  );
  assert.equal(
    strictMatchShopCatalogV2Compatibility(parentDependent, {
      make: "bmw",
      model: "m2",
      engine: "s58",
    }).status,
    "requires_verification"
  );

  const unresolved = { ...parentDependent, parentTarget: null };
  const unresolvedResult = strictMatchShopCatalogV2Compatibility(unresolved, { make: "bmw" });
  assert.equal(unresolvedResult.status, "requires_verification");
  assert.ok(unresolvedResult.validationErrors.some((error) => error.includes("parentTarget")));
});
