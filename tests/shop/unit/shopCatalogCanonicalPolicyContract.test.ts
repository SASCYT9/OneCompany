import assert from "node:assert/strict";
import test from "node:test";

import {
  type CanonicalPolicyExcludedClause,
  type CanonicalPolicyImportResult,
  validateLosslessPolicyContract,
} from "../../../src/lib/shopCatalogCanonicalPolicyContract";
import type { ShopCatalogV2CompatibilityPolicy } from "../../../src/lib/shopCatalogV2Compatibility";

function policy(
  clause: ShopCatalogV2CompatibilityPolicy["clauses"][number]
): ShopCatalogV2CompatibilityPolicy {
  return {
    version: 2,
    mode: "NEEDS_REVIEW",
    target: { productId: "product-1" },
    requiredDimensions: [],
    clauses: [clause],
  };
}

function excluded(
  id: string,
  reason: CanonicalPolicyExcludedClause["reason"],
  rawClause: unknown
): CanonicalPolicyExcludedClause {
  return {
    id,
    reason,
    verification: reason === "INFERRED" ? "INFERRED" : "NEEDS_REVIEW",
    sourceRef: `source:${id}`,
    evidenceHash: "a".repeat(64),
    rawClause,
  };
}

function result(
  policies: readonly ShopCatalogV2CompatibilityPolicy[],
  excludedClauses: readonly CanonicalPolicyExcludedClause[]
): CanonicalPolicyImportResult {
  const verification = { VERIFIED: 0, INFERRED: 0, NEEDS_REVIEW: 0 } as const;
  return {
    policies,
    excludedClauses,
    completeness: {
      source: "kw-fi",
      totalClauses: policies.flatMap((item) => item.clauses).length + excludedClauses.length,
      includedClauses: policies.flatMap((item) => item.clauses).length,
      excludedClauses: excludedClauses.length,
      verification,
      complete: excludedClauses.length === 0,
    },
  };
}

test("KW null make is excluded with its raw application retained", () => {
  const excludedClause = excluded("kw-null-make", "NULL_MAKE", {
    make: null,
    model: "3 Series",
    chassisCodes: ["G20", "G80"],
    verification: "INFERRED",
  });
  const errors = validateLosslessPolicyContract(result([], [excludedClause]));
  assert.deepEqual(errors, []);
  assert.equal((excludedClause.rawClause as { make: null }).make, null);
  assert.deepEqual((excludedClause.rawClause as { chassisCodes: string[] }).chassisCodes, [
    "G20",
    "G80",
  ]);
});

test("KW multichassis and INFERRED applications remain explicit exclusions", () => {
  const excludedClauses = [
    excluded("kw-multichassis", "MULTI_CHASSIS", { make: "BMW", chassisCodes: ["G20", "G80"] }),
    excluded("kw-inferred", "INFERRED", {
      make: "BMW",
      model: "3 Series",
      verification: "INFERRED",
    }),
  ];
  assert.deepEqual(validateLosslessPolicyContract(result([], excludedClauses)), []);
  assert.equal(excludedClauses[0]!.reason, "MULTI_CHASSIS");
  assert.equal(excludedClauses[1]!.verification, "INFERRED");
});

test("FI review clause may retain make/model/body without synthetic year, engine, or fuel", () => {
  const review = policy({
    id: "fi-review",
    verification: "NEEDS_REVIEW",
    sourceRef: "fi:42",
    constraints: [
      { dimension: "scope", state: "EXACT", values: ["auto"] },
      { dimension: "make", state: "EXACT", values: ["BMW"] },
      { dimension: "model", state: "EXACT", values: ["M5"] },
      { dimension: "chassis", state: "EXACT", values: ["G90"] },
      { dimension: "year", state: "UNKNOWN" },
      { dimension: "engine", state: "UNKNOWN" },
      { dimension: "fuel", state: "UNKNOWN" },
    ],
  });
  assert.deepEqual(validateLosslessPolicyContract(result([review], [])), []);
  assert.deepEqual(
    review.clauses[0]!.constraints.filter((item) =>
      ["year", "engine", "fuel"].includes(item.dimension)
    ),
    [
      { dimension: "year", state: "UNKNOWN" },
      { dimension: "engine", state: "UNKNOWN" },
      { dimension: "fuel", state: "UNKNOWN" },
    ]
  );
});

test("validator rejects EXACT null make and raw engine text under VERIFIED", () => {
  const badMake = policy({
    id: "bad-make",
    verification: "VERIFIED",
    constraints: [{ dimension: "make", state: "EXACT", values: [null as never] }],
  });
  const badEngine = policy({
    id: "bad-engine",
    verification: "VERIFIED",
    constraints: [{ dimension: "engine", state: "EXACT", values: ["S68"] }],
  });
  assert.match(validateLosslessPolicyContract(badMake).join("\n"), /EXACT make/);
  assert.match(
    validateLosslessPolicyContract(badEngine).join("\n"),
    /canonical powertrain identity/
  );
});
