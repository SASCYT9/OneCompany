import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiCompatibilityPolicy } from "../../../src/lib/shopCatalogFiPolicyEvidence";
import { validateLosslessPolicyContract } from "../../../src/lib/shopCatalogCanonicalPolicyContract";
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
