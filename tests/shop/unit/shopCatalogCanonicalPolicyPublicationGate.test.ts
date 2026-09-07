import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCanonicalPolicyPublication } from "../../../src/lib/shopCatalogCanonicalPolicyPublicationGate";
import type {
  CanonicalPolicyExcludedClause,
  CanonicalPolicyImportResult,
} from "../../../src/lib/shopCatalogCanonicalPolicyContract";
import type { ShopCatalogV2CompatibilityPolicy } from "../../../src/lib/shopCatalogV2Compatibility";

function importResult(
  policies: readonly ShopCatalogV2CompatibilityPolicy[],
  excludedClauses: readonly CanonicalPolicyExcludedClause[] = [],
  complete = excludedClauses.length === 0
): CanonicalPolicyImportResult {
  return {
    policies,
    excludedClauses,
    completeness: {
      source: "fi",
      totalClauses: policies.flatMap((policy) => policy.clauses).length + excludedClauses.length,
      includedClauses: policies.flatMap((policy) => policy.clauses).length,
      excludedClauses: excludedClauses.length,
      verification: {
        VERIFIED: 0,
        INFERRED: 0,
        NEEDS_REVIEW: policies.flatMap((policy) => policy.clauses).length,
      },
      complete,
    },
  };
}

const fiReviewPolicy: ShopCatalogV2CompatibilityPolicy = {
  version: 2,
  mode: "NEEDS_REVIEW",
  target: { productId: "fi-product" },
  requiredDimensions: [],
  clauses: [
    {
      id: "fi-review-1",
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
    },
  ],
};

test("FI review policy is publication-ready while preserving unknown dimensions", () => {
  const decision = evaluateCanonicalPolicyPublication(importResult([fiReviewPolicy]));
  assert.equal(decision.status, "READY");
  assert.deepEqual(decision.errors, []);
  assert.equal(decision.excludedClauseCount, 0);
});

test("KW excluded clauses block publication and retain the explicit count", () => {
  const decision = evaluateCanonicalPolicyPublication(
    importResult(
      [],
      [
        {
          id: "kw-null-make",
          reason: "NULL_MAKE",
          verification: "NEEDS_REVIEW",
          sourceRef: "kw:1",
          evidenceHash: "a".repeat(64),
          rawClause: { make: null, model: "3 Series", chassisCodes: ["G20", "G80"] },
        },
      ]
    )
  );
  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.excludedClauseCount, 1);
  assert.match(decision.errors.join("\n"), /resolving 1 excluded clause/);
});

test("invalid canonical policy blocks publication before any persistence call", () => {
  const invalid = structuredClone(fiReviewPolicy);
  invalid.clauses[0]!.constraints = [{ dimension: "engine", state: "EXACT", values: ["S68"] }];
  invalid.clauses[0]!.verification = "VERIFIED";
  const decision = evaluateCanonicalPolicyPublication(importResult([invalid]));
  assert.equal(decision.status, "BLOCKED");
  assert.match(decision.errors.join("\n"), /canonical powertrain identity/);
});
