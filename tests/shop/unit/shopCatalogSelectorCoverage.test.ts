import assert from "node:assert/strict";
import test from "node:test";
import {
  compareSelectorCoverage,
  selectorPoliciesFromProjection,
  summarizeSelectorDimensionCoverage,
} from "../../../src/lib/shopCatalogSelectorCoverage";
import type { ShopCatalogV2CompatibilityPolicy as Policy } from "../../../src/lib/shopCatalogV2Compatibility";
import type { ShopCatalogProjectionBuild as Build } from "../../../src/lib/shopCatalogProjection.server";

const strict = { canonicalIdentity: true, policyRules: true, clauseIdentity: true };
function policy(): Policy {
  return {
    version: 2,
    mode: "VEHICLE_SPECIFIC",
    target: { productId: "product", variantId: "variant" },
    requiredDimensions: ["make", "model"],
    dimensionDefaults: { engine: "UNKNOWN" },
    clauses: [
      {
        id: "a4",
        verification: "VERIFIED",
        sourceRef: "record",
        constraints: [
          { dimension: "make", state: "EXACT", values: ["Audi"] },
          { dimension: "model", state: "EXACT", values: ["A4"] },
          { dimension: "chassis", state: "EXACT", values: ["B9"] },
          {
            dimension: "engine",
            state: "EXACT",
            values: [{ kind: "powertrain", powertrainId: "engine-1", code: "EA888" }],
          },
          { dimension: "year", state: "EXACT", values: [{ from: 2020, to: 2022 }] },
        ],
      },
      {
        id: "q5",
        verification: "NEEDS_REVIEW",
        sourceRef: "record",
        constraints: [
          { dimension: "make", state: "EXACT", values: ["Audi"] },
          { dimension: "model", state: "EXACT", values: ["Q5"] },
          { dimension: "chassis", state: "EXACT", values: ["FY"] },
          { dimension: "engine", state: "UNKNOWN" },
        ],
      },
    ],
  };
}

test("missing model fails even when another model of the same make survives", () => {
  const expected = policy();
  const actual = { ...expected, clauses: expected.clauses.slice(0, 1) };
  assert.equal(compareSelectorCoverage([expected], [actual]).missingCount, 1);
});

test("same counts and dimension sets cannot hide swapped chassis across models", () => {
  const expected = policy();
  const actual = structuredClone(expected);
  const [first, second] = actual.clauses.map((clause) =>
    clause.constraints.find((item) => item.dimension === "chassis")!
  );
  if (first.state === "EXACT" && second.state === "EXACT")
    [first.values, second.values] = [second.values, first.values];
  const result = compareSelectorCoverage([expected], [actual]);
  assert.equal(result.missingCount, 2);
  assert.equal(result.extraCount, 2);
});

test("unknown, any, non-applicable and review are distinct evidence", () => {
  for (const state of ["ANY", "NOT_APPLICABLE"] as const) {
    const expected = policy();
    const actual = structuredClone(expected);
    const engine = actual.clauses[1].constraints.find((item) => item.dimension === "engine")!;
    engine.state = state;
    assert.equal(compareSelectorCoverage([expected], [actual]).passed, false);
  }
  const expected = policy();
  const actual = structuredClone(expected);
  actual.clauses[1].verification = "VERIFIED";
  assert.equal(compareSelectorCoverage([expected], [actual]).passed, false);
});

test("dimension coverage separates known vehicle identity from unrelated unknown fields", () => {
  const source = policy();
  source.dimensionDefaults = { engine: "UNKNOWN", fuel: "UNKNOWN" };
  source.clauses = [
    {
      id: "m3",
      verification: "VERIFIED",
      constraints: [
        { dimension: "scope", state: "EXACT", values: ["auto"] },
        { dimension: "make", state: "EXACT", values: ["BMW"] },
        { dimension: "model", state: "EXACT", values: ["M3"] },
        { dimension: "generation", state: "EXACT", values: ["G80"] },
      ],
    },
  ];
  const report = summarizeSelectorDimensionCoverage([source]);
  assert.equal(report.dimensions.make.verifiedExactClauses, 1);
  assert.equal(report.dimensions.model.verifiedExactClauses, 1);
  assert.equal(report.dimensions.generation.verifiedExactClauses, 1);
  assert.equal(report.dimensions.engine.unknownClauses, 1);
  assert.equal(report.dimensions.fuel.unknownClauses, 1);
  assert.deepEqual(report.byMake, [
    {
      make: "BMW",
      clauses: 1,
      verifiedCoreIdentityClauses: 1,
      reviewOrInferredCoreIdentityClauses: 0,
      selectorEligibleCoreIdentityClauses: 0,
      blockedByUnknownDimensionClauses: 1,
      blockedByPolicyModeClauses: 0,
      models: ["M3"],
      generations: ["G80"],
    },
  ]);
});

test("target, year range, duplicate clauses and dropped engine identity fail", () => {
  const expected = policy();
  const otherTarget = { ...expected, target: { productId: "product", variantId: "other" } };
  assert.equal(compareSelectorCoverage([expected], [otherTarget]).passed, false);
  assert.equal(
    compareSelectorCoverage(
      [expected],
      [{ ...expected, clauses: [...expected.clauses, expected.clauses[0]] }]
    ).extraCount,
    1
  );
  const actual = structuredClone(expected);
  const engine = actual.clauses[0].constraints.find((item) => item.dimension === "engine")!;
  if (engine.state === "EXACT") engine.values = ["EA888"];
  assert.equal(compareSelectorCoverage([expected], [actual]).passed, true);
  assert.equal(compareSelectorCoverage([expected], [actual], strict).passed, false);
  const year = actual.clauses[0].constraints.find((item) => item.dimension === "year")!;
  if (year.state === "EXACT") year.values = [{ from: 2020, to: null }];
  assert.equal(compareSelectorCoverage([expected], [actual]).passed, false);
});

test("ordering is irrelevant but policy requirements and provenance are not", () => {
  const expected = policy();
  const reordered = {
    ...expected,
    requiredDimensions: [...expected.requiredDimensions].reverse(),
    clauses: [...expected.clauses]
      .reverse()
      .map((clause) => ({ ...clause, constraints: [...clause.constraints].reverse() })),
  };
  assert.equal(compareSelectorCoverage([expected], [reordered], strict).passed, true);
  assert.equal(
    compareSelectorCoverage([expected], [{ ...expected, requiredDimensions: [] }], strict).passed,
    false
  );
  const altered = structuredClone(expected);
  altered.clauses[0].sourceRef = "another-record";
  assert.equal(compareSelectorCoverage([expected], [altered]).passed, false);
});

function projection(): Build {
  const base = { productId: "product", variantId: "variant", sourceVersion: "1" };
  return {
    schemaVersion: 1,
    catalogVersion: "1",
    projectionVersion: "1",
    sourceUpdatedAt: null,
    sourceContentHash: "",
    canonicalRelationHash: "",
    canonicalRelationCounts: [],
    projections: [],
    skuRecords: [],
    contentHash: "",
    productId: "product",
    sourceVersion: "1",
    compatibilityPolicies: [
      {
        ...base,
        parentProductId: null,
        parentVariantId: null,
        mode: "VEHICLE_SPECIFIC",
        requiredDimensions: ["model"],
        dimensionDefaults: [],
        clauseCount: 1,
      },
    ],
    compatibilityClauses: [
      { ...base, clauseId: "clause", verification: "VERIFIED", sourceRef: "record" },
    ],
    compatibilityConstraints: [
      {
        ...base,
        clauseId: "clause",
        dimension: "model",
        state: "EXACT",
        valueOrdinal: 0,
        value: { kind: "text", text: "M5" },
      },
    ],
  } satisfies Build;
}

test("projection reconstruction rejects orphan, wrong owner/version and duplicate ordinals", () => {
  const valid = projection();
  assert.deepEqual(selectorPoliciesFromProjection(valid)[0].clauses[0].constraints, [
    { dimension: "model", state: "EXACT", values: ["M5"] },
  ]);
  for (const patch of [
    { productId: "other" },
    { sourceVersion: "2" },
    { clauseId: "orphan" },
    { variantId: null },
  ]) {
    const broken = projection();
    Object.assign(broken.compatibilityConstraints[0], patch);
    assert.throws(() => selectorPoliciesFromProjection(broken), /mismatch|Orphan/);
  }
  const duplicated = projection();
  duplicated.compatibilityConstraints = [
    ...duplicated.compatibilityConstraints,
    duplicated.compatibilityConstraints[0],
  ];
  assert.throws(() => selectorPoliciesFromProjection(duplicated), /ordinal/);
});

test("coverage mismatch reports are bounded without losing failure counts", () => {
  const result = compareSelectorCoverage(Array.from({ length: 100 }, policy), []);
  assert.equal(result.missingCount, 300);
  assert.equal(result.missing.length, 10);
});

test("source taxonomy label casing may differ while identity and scope stay strict", () => {
  const expected = policy();
  const actual = structuredClone(expected);
  for (const clause of actual.clauses)
    for (const constraint of clause.constraints) {
      if (["make", "model"].includes(constraint.dimension) && constraint.state === "EXACT")
        constraint.values = constraint.values.map((value) =>
          typeof value === "string" ? value.toLowerCase() : value
        );
    }
  assert.equal(compareSelectorCoverage([expected], [actual]).passed, false);
  assert.equal(
    compareSelectorCoverage([expected], [actual], { caseInsensitiveTaxonomy: true }).passed,
    true
  );
  assert.equal(compareSelectorCoverage([expected], [actual], strict).passed, false);
  const model = actual.clauses[0].constraints.find(
    (constraint) => constraint.dimension === "model"
  )!;
  if (model.state === "EXACT") model.values = ["a5"];
  assert.equal(
    compareSelectorCoverage([expected], [actual], { caseInsensitiveTaxonomy: true }).passed,
    false
  );
  const auto = {
    ...expected,
    clauses: expected.clauses.map((clause) => ({
      ...clause,
      constraints: [
        ...clause.constraints,
        { dimension: "scope" as const, state: "EXACT" as const, values: ["auto"] },
      ],
    })),
  };
  const moto = {
    ...expected,
    clauses: expected.clauses.map((clause) => ({
      ...clause,
      constraints: [
        ...clause.constraints,
        { dimension: "scope" as const, state: "EXACT" as const, values: ["moto"] },
      ],
    })),
  };
  assert.equal(
    compareSelectorCoverage([auto], [moto], { caseInsensitiveTaxonomy: true }).passed,
    false
  );
});
