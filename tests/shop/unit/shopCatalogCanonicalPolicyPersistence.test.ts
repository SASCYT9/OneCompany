import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiCompatibilityPolicy } from "../../../src/lib/shopCatalogFiPolicyEvidence";
import { validateLosslessPolicyContract } from "../../../src/lib/shopCatalogCanonicalPolicyContract";
import { expandCanonicalPolicyTaxonomyAlternatives } from "../../../src/lib/shopCatalogCanonicalPolicyHelpers";
import type { FiFitmentEntry } from "../../../src/lib/shopCatalogFiDraft";

const fiFitment: FiFitmentEntry = {
  id: "42",
  handle: "fi-42",
  status: "CSV_CORRELATED",
  applications: [{ brand: "BMW", model: "M5", body: "G90" }],
};

test("FI canonical policy keeps source-supported dimensions and marks absent facts UNKNOWN", () => {
  const policy = buildFiCompatibilityPolicy("product-42", fiFitment);
  assert.equal(policy.mode, "VEHICLE_SPECIFIC");
  assert.deepEqual(policy.requiredDimensions, ["make", "model"]);
  const constraints = new Map(policy.clauses[0]!.constraints.map((item) => [item.dimension, item]));
  assert.deepEqual(constraints.get("make"), { dimension: "make", state: "EXACT", values: ["BMW"] });
  assert.deepEqual(constraints.get("model"), {
    dimension: "model",
    state: "EXACT",
    values: ["M5"],
  });
  assert.deepEqual(constraints.get("chassis"), {
    dimension: "chassis",
    state: "EXACT",
    values: ["G90"],
  });
  for (const dimension of [
    "year",
    "engine",
    "fuel",
    "bodyStyle",
    "drivetrain",
    "transmission",
    "market",
    "opfGpf",
  ] as const) {
    assert.deepEqual(constraints.get(dimension), { dimension, state: "UNKNOWN" });
  }
  assert.deepEqual(validateLosslessPolicyContract(policy), []);
});

test("incomplete FI evidence stays review-only and never creates an exact empty make", () => {
  const policy = buildFiCompatibilityPolicy("product-review", {
    ...fiFitment,
    status: "REVIEW_REQUIRED",
    applications: [{ brand: "", model: "M5", body: "G90" }],
  });
  assert.equal(policy.mode, "NEEDS_REVIEW");
  assert.equal(
    policy.clauses[0]!.constraints.some(
      (item) => item.dimension === "make" && item.state === "EXACT"
    ),
    false
  );
  assert.deepEqual(validateLosslessPolicyContract(policy), []);
});

test("canonical persistence expands taxonomy alternatives into clause-correlated identities", () => {
  const policy = {
    version: 2 as const,
    mode: "VEHICLE_SPECIFIC" as const,
    target: { productId: "multi-model-product" },
    requiredDimensions: ["make", "model"] as const,
    clauses: [{
      id: "supplier-multi-model",
      verification: "VERIFIED" as const,
      constraints: [
        { dimension: "scope" as const, state: "EXACT" as const, values: ["auto"] },
        { dimension: "make" as const, state: "EXACT" as const, values: ["Audi", "BMW"] },
        { dimension: "model" as const, state: "EXACT" as const, values: ["M5", "RS5"] },
        { dimension: "generation" as const, state: "EXACT" as const, values: ["G90", "B9.5"] },
        { dimension: "chassis" as const, state: "UNKNOWN" as const },
        { dimension: "year" as const, state: "UNKNOWN" as const },
        { dimension: "engine" as const, state: "UNKNOWN" as const },
        { dimension: "fuel" as const, state: "UNKNOWN" as const },
        { dimension: "bodyStyle" as const, state: "UNKNOWN" as const },
        { dimension: "drivetrain" as const, state: "UNKNOWN" as const },
        { dimension: "transmission" as const, state: "UNKNOWN" as const },
        { dimension: "market" as const, state: "UNKNOWN" as const },
        { dimension: "opfGpf" as const, state: "UNKNOWN" as const },
      ],
    }],
  };
  assert.deepEqual(validateLosslessPolicyContract(policy), []);
  const expanded = expandCanonicalPolicyTaxonomyAlternatives(policy);
  assert.equal(expanded.clauses.length, 8);
  const identities = expanded.clauses.map((clause) => {
    const value = (dimension: "make" | "model" | "generation") => {
      const constraint = clause.constraints.find((item) => item.dimension === dimension);
      assert.equal(constraint?.state, "EXACT");
      if (constraint?.state !== "EXACT") return "";
      assert.equal(constraint.values.length, 1);
      return String(constraint.values[0]);
    };
    return `${value("make")}|${value("model")}|${value("generation")}`;
  });
  assert.equal(new Set(identities).size, 8);
});

test("KW and FI writers persist policy before their transaction can report inserted", () => {
  const kwWriter = readFileSync("src/lib/shopCatalogKwImportWriter.server.ts", "utf8");
  const fiWriter = readFileSync("src/lib/shopCatalogFiImportWriter.server.ts", "utf8");
  for (const [label, source] of [
    ["KW", kwWriter],
    ["FI", fiWriter],
  ] as const) {
    assert.match(source, /persistCanonicalPolicyInTransaction/);
    assert.match(source, /evidenceHash: evidence\.payloadHash/);
    assert.match(source, new RegExp(`${label} immutable replay is missing its canonical policy`));
    assert.match(source, /sourceRecordId: previous\?\.id/);
    assert.match(source, /isActive: true/);
  }
});
