import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNormalizationCoveragePolicy,
  type CoverageNormalization,
} from "../../../src/lib/shopCatalogNormalizationCoverage";

const sources = [
  "adro",
  "akrapovic",
  "brabus",
  "burger",
  "csf",
  "do88",
  "eventuri",
  "girodisc",
  "ilmberger",
  "ipe",
  "ohlins",
  "racechip",
  "remus",
  "urban",
];

function draft(overrides: Partial<CoverageNormalization> = {}): CoverageNormalization {
  return {
    productId: "product",
    variantId: "variant",
    recordKey: "source:record",
    verification: "VERIFIED",
    mode: "VEHICLE_SPECIFIC",
    applications: [
      {
        make: "BMW",
        model: "M5",
        generation: "G90",
        yearFrom: 2024,
        engineCode: "S68",
        fuel: "petrol",
        transmission: "automatic",
        opfGpf: "OPF",
      },
    ],
    engineRelevant: true,
    transmissionRelevant: true,
    opfGpfRelevant: true,
    ...overrides,
  };
}

test("all fourteen sources have explicit accepted coverage descriptors", () => {
  for (const source of sources) {
    const policy = buildNormalizationCoveragePolicy(
      source,
      draft({
        ...(source === "racechip"
          ? { applications: undefined, make: "BMW", model: "M5", engineDescriptor: "S68" }
          : {}),
        ...(source === "ilmberger" || source === "remus" ? { variantId: null } : {}),
      })
    );
    assert.equal(policy.clauses.length, 1, source);
    assert.equal(policy.clauses[0]!.constraints.length, 13, source);
  }
  assert.throws(
    () => buildNormalizationCoveragePolicy("unknown", draft()),
    /Unknown catalog normalization source/
  );
});

test("auto application keeps correlated year engine fuel transmission and OPF evidence", () => {
  const policy = buildNormalizationCoveragePolicy("ipe", draft());
  const clause = policy.clauses[0]!;
  assert.equal(clause.sourceRef, "source:record");
  assert.deepEqual(policy.target, { productId: "product", variantId: "variant" });
  assert.deepEqual(
    clause.constraints.find((value) => value.dimension === "year"),
    { dimension: "year", state: "EXACT", values: [{ from: 2024, to: null }] }
  );
  assert.deepEqual(
    clause.constraints.find((value) => value.dimension === "engine"),
    { dimension: "engine", state: "EXACT", values: ["S68"] }
  );
  assert.deepEqual(
    clause.constraints.find((value) => value.dimension === "opfGpf"),
    { dimension: "opfGpf", state: "EXACT", values: ["OPF"] }
  );
});

test("RaceChip retains its single-application engine and canonical target evidence", () => {
  const policy = buildNormalizationCoveragePolicy(
    "racechip",
    draft({
      applications: undefined,
      make: "BMW",
      model: "M3",
      generation: "G80",
      yearFrom: 2021,
      engineDescriptor: "S58",
      fuel: "petrol",
    })
  );
  assert.equal(policy.mode, "VEHICLE_SPECIFIC");
  assert.ok(policy.requiredDimensions.includes("year"));
  assert.ok(policy.requiredDimensions.includes("engine"));
  assert.ok(policy.requiredDimensions.includes("fuel"));
  assert.deepEqual(
    policy.clauses[0]!.constraints.find((value) => value.dimension === "engine"),
    { dimension: "engine", state: "EXACT", values: ["S58"] }
  );
  assert.deepEqual(
    policy.clauses[0]!.constraints.find((value) => value.dimension === "chassis"),
    { dimension: "chassis", state: "NOT_APPLICABLE" }
  );
  assert.deepEqual(
    policy.clauses[0]!.constraints.find((value) => value.dimension === "bodyStyle"),
    { dimension: "bodyStyle", state: "NOT_APPLICABLE" }
  );
  assert.deepEqual(
    policy.clauses[0]!.constraints.find((value) => value.dimension === "market"),
    { dimension: "market", state: "NOT_APPLICABLE" }
  );
});

test("ADRO keeps its bespoke generation chassis and non-engine defaults", () => {
  const policy = buildNormalizationCoveragePolicy(
    "adro",
    draft({
      engineRelevant: false,
      transmissionRelevant: false,
      opfGpfRelevant: false,
      applications: [{ make: "BMW", model: "M5", generation: "G90", yearFrom: 2024 }],
    })
  );
  const constraints = policy.clauses[0]!.constraints;
  assert.deepEqual(
    constraints.find((value) => value.dimension === "generation"),
    { dimension: "generation", state: "EXACT", values: ["G90"] }
  );
  assert.deepEqual(
    constraints.find((value) => value.dimension === "chassis"),
    { dimension: "chassis", state: "EXACT", values: ["G90"] }
  );
  assert.deepEqual(
    constraints.find((value) => value.dimension === "engine"),
    { dimension: "engine", state: "NOT_APPLICABLE" }
  );
  assert.deepEqual(
    constraints.find((value) => value.dimension === "bodyStyle"),
    { dimension: "bodyStyle", state: "ANY" }
  );
  assert.deepEqual(
    constraints.find((value) => value.dimension === "market"),
    { dimension: "market", state: "ANY" }
  );
});

test("moto product targets, universal clauses, and review states remain explicit", () => {
  const moto = buildNormalizationCoveragePolicy(
    "ilmberger",
    draft({
      variantId: null,
      engineRelevant: false,
      applications: [{ make: "BMW", model: "S 1000 R", yearFrom: 2021 }],
    })
  );
  assert.deepEqual(moto.target, { productId: "product" });
  assert.deepEqual(
    moto.clauses[0]!.constraints.find((value) => value.dimension === "scope"),
    { dimension: "scope", state: "EXACT", values: ["moto"] }
  );
  const universal = buildNormalizationCoveragePolicy(
    "burger",
    draft({ mode: "UNIVERSAL", engineRelevant: false, applications: [] })
  );
  assert.equal(universal.mode, "UNIVERSAL");
  assert.equal(universal.clauses[0]!.constraints.length, 13);
  assert.deepEqual(
    universal.clauses[0]!.constraints.find((value) => value.dimension === "engine"),
    { dimension: "engine", state: "NOT_APPLICABLE" }
  );
  const review = buildNormalizationCoveragePolicy(
    "eventuri",
    draft({
      mode: "PARENT_DEPENDENT",
      verification: "NEEDS_REVIEW",
      applications: [],
      engineRelevant: true,
    })
  );
  assert.equal(review.mode, "NEEDS_REVIEW");
  assert.equal(review.clauses[0]!.verification, "NEEDS_REVIEW");
  assert.deepEqual(
    review.clauses[0]!.constraints.find((value) => value.dimension === "engine"),
    { dimension: "engine", state: "UNKNOWN" }
  );
  assert.deepEqual(
    review.clauses[0]!.constraints.find((value) => value.dimension === "transmission"),
    { dimension: "transmission", state: "UNKNOWN" }
  );
  assert.deepEqual(
    review.clauses[0]!.constraints.find((value) => value.dimension === "opfGpf"),
    { dimension: "opfGpf", state: "UNKNOWN" }
  );
});

test("ADRO retains a supplied empty application list as zero clauses", () => {
  const policy = buildNormalizationCoveragePolicy(
    "adro",
    draft({ mode: "NEEDS_REVIEW", verification: "NEEDS_REVIEW", applications: [] })
  );
  assert.equal(policy.clauses.length, 0);
});
