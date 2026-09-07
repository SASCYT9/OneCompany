import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopCatalogSelectorReadModel,
  sliceShopCatalogSelectorOptions,
  type ShopCatalogSelectorPolicyInput,
} from "../../../src/lib/shopCatalogSelectorReadModel";
import {
  normalizeLegacyApplicationsToShopCatalogV2Policy,
  type ShopCatalogV2CompatibilityPolicy,
} from "../../../src/lib/shopCatalogV2Compatibility";

function entry(
  productId: string,
  application: Record<string, unknown>,
  overrides: Partial<ShopCatalogSelectorPolicyInput> = {}
): ShopCatalogSelectorPolicyInput {
  const policy = normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId },
    verification: "VERIFIED",
    dimensionDefaults: {
      make: "ANY",
      model: "ANY",
      generation: "ANY",
      chassis: "ANY",
      year: "ANY",
      engine: "ANY",
      fuel: "ANY",
      bodyStyle: "ANY",
      drivetrain: "ANY",
      transmission: "ANY",
      market: "ANY",
      opfGpf: "ANY",
    },
    applications: [{ vehicleType: "car", ...application }],
  });
  return {
    policy,
    scope: "auto",
    brand: "Eventuri",
    source: { sourceId: "shopify", revision: 7, coverageComplete: true },
    visibility: { isPublished: true, status: "ACTIVE" },
    ...overrides,
  };
}

test("builds complete deduped options and retains clause correlation", () => {
  const first = entry("p-a4", {
    id: "a4-c7",
    make: "Audi",
    model: "A4",
    generation: "B9",
    chassisCode: "8W",
    yearFrom: 2016,
    yearTo: 2020,
    engine: "EA888",
  });
  const second = entry(
    "p-q5",
    {
      id: "q5-fy",
      make: "Audi",
      model: "Q5",
      generation: "FY",
      chassisCode: "FY",
      yearFrom: 2017,
      yearTo: 2021,
      engine: "EA888",
    },
    { brand: "KW" }
  );
  const model = buildShopCatalogSelectorReadModel({
    projectionVersion: 42,
    policies: [second, first],
    sourceCoverage: { complete: true, expectedPolicyCount: 2 },
  });
  assert.equal(model.complete, true);
  assert.deepEqual(model.options.makes, ["audi"]);
  assert.deepEqual(model.options.models, ["a4", "q5"]);
  assert.deepEqual(model.options.chassis, ["8w", "fy"]);
  assert.deepEqual(model.options.generations, ["b9", "fy"]);
  assert.deepEqual(model.options.engines, ["ea888"]);
  assert.deepEqual(model.options.years, [2021, 2020, 2019, 2018, 2017, 2016]);
  assert.equal(model.applications.length, 2);
  assert.equal(model.applications[0]?.models[0], "a4");
  assert.equal(model.applications[1]?.models[0], "q5");
  assert.match(model.coverageFingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(model.coverageFingerprint, model.fingerprint);
});

test("unknown and review clauses fail closed without emitting their values", () => {
  const unknown = entry("p-unknown", {
    id: "unknown",
    make: "BMW",
    model: "M5",
    chassisCode: "G90",
    engine: "S68",
  });
  unknown.policy = {
    ...unknown.policy,
    clauses: [
      {
        ...unknown.policy.clauses[0]!,
        constraints: unknown.policy.clauses[0]!.constraints.map((constraint) =>
          constraint.dimension === "engine"
            ? { dimension: "engine", state: "UNKNOWN" as const }
            : constraint
        ),
      },
    ],
  } satisfies ShopCatalogV2CompatibilityPolicy;
  const review = entry("p-review", {
    id: "review",
    make: "BMW",
    model: "X5",
    chassisCode: "G05",
  });
  review.policy = {
    ...review.policy,
    clauses: [{ ...review.policy.clauses[0]!, verification: "NEEDS_REVIEW" }],
  };
  const model = buildShopCatalogSelectorReadModel({
    projectionVersion: 1,
    policies: [unknown, review],
    sourceCoverage: { complete: true, expectedPolicyCount: 2 },
  });
  assert.equal(model.complete, false);
  assert.deepEqual(model.options.makes, []);
  assert.deepEqual(model.options.engines, []);
  assert.ok(model.reasons.some((reason) => reason.includes("UNKNOWN engine")));
  assert.ok(model.reasons.some((reason) => reason.includes("NEEDS_REVIEW")));
});

test("missing source coverage and visibility metadata are explicit failures", () => {
  const missingSource = entry(
    "p-missing",
    { id: "missing", make: "Mini", model: "Cooper" },
    { source: null }
  );
  const missingVisibility = entry(
    "p-visibility",
    { id: "visibility", make: "BMW", model: "M3" },
    { visibility: null }
  );
  const model = buildShopCatalogSelectorReadModel({
    projectionVersion: 3,
    policies: [missingSource, missingVisibility],
  });
  assert.equal(model.complete, false);
  assert.equal(model.coverage.source.complete, false);
  assert.ok(model.reasons.some((reason) => reason.includes("missing source coverage")));
  assert.ok(model.reasons.some((reason) => reason.includes("missing visibility coverage")));
  assert.deepEqual(model.options.models, ["cooper"]);
});

test("selector slices are bounded and continuation is fingerprint-bound", () => {
  const policies = ["A", "B", "C"].map((model) =>
    entry(`p-${model}`, { id: model, make: "BMW", model, chassisCode: `C-${model}` })
  );
  const artifact = buildShopCatalogSelectorReadModel({
    projectionVersion: 9,
    policies,
    sourceCoverage: { complete: true, expectedPolicyCount: 3 },
  });
  const first = sliceShopCatalogSelectorOptions(artifact, { dimension: "models", limit: 2 });
  assert.deepEqual(first.values, ["a", "b"]);
  assert.equal(first.hasMore, true);
  const second = sliceShopCatalogSelectorOptions(artifact, {
    dimension: "models",
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.deepEqual(second.values, ["c"]);
  assert.equal(second.nextCursor, null);
  assert.throws(
    () =>
      sliceShopCatalogSelectorOptions(artifact, {
        dimension: "models",
        cursor: `${"0".repeat(64)}:0`,
      }),
    /does not match/
  );
});
