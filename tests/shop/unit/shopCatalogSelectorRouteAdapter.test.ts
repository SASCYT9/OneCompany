import assert from "node:assert/strict";
import test from "node:test";

import { buildShopCatalogSelectorReadModel } from "../../../src/lib/shopCatalogSelectorReadModel";
import { selectShopCatalogFitmentFromReadModel } from "../../../src/lib/shopCatalogSelectorRouteAdapter";
import { normalizeLegacyApplicationsToShopCatalogV2Policy } from "../../../src/lib/shopCatalogV2Compatibility";

function policy(productId: string, application: Record<string, unknown>) {
  return {
    policy: normalizeLegacyApplicationsToShopCatalogV2Policy({
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
    }),
    scope: "auto" as const,
    brand: "Eventuri",
    source: { sourceId: "shopify", revision: 3, coverageComplete: true },
    visibility: { isPublished: true, status: "ACTIVE" },
  };
}

function artifact() {
  return buildShopCatalogSelectorReadModel({
    projectionVersion: 4,
    policies: [
      policy("p-a4", {
        id: "a4",
        make: "Audi",
        model: "A4",
        generation: "B9",
        chassisCode: "8W",
        yearFrom: 2016,
        yearTo: 2020,
        engine: "EA888",
      }),
      policy("p-q5", {
        id: "q5",
        make: "Audi",
        model: "Q5",
        generation: "FY",
        chassisCode: "FY",
        yearFrom: 2017,
        yearTo: 2021,
        engine: "EA888",
      }),
    ],
    sourceCoverage: { complete: true, expectedPolicyCount: 2 },
  });
}

test("selector route adapter keeps options tied to the same clause", () => {
  const model = artifact();
  assert.deepEqual(
    selectShopCatalogFitmentFromReadModel(model, {
      make: "Audi",
      model: null,
      chassis: null,
      scope: "auto",
      brand: "Eventuri",
      details: false,
      year: null,
    }),
    { type: "models", make: "Audi", data: ["a4", "q5"] }
  );
  assert.deepEqual(
    selectShopCatalogFitmentFromReadModel(model, {
      make: "Audi",
      model: "Q5",
      chassis: null,
      scope: "auto",
      brand: "Eventuri",
      details: false,
      year: null,
    }),
    { type: "chassis", make: "Audi", model: "Q5", data: ["fy"] }
  );
});

test("details and engine responses respect selected chassis and year", () => {
  const model = artifact();
  const query = {
    make: "Audi",
    model: "A4",
    chassis: "8W",
    scope: "auto" as const,
    brand: "Eventuri",
    details: true,
    year: 2018,
  };
  assert.deepEqual(selectShopCatalogFitmentFromReadModel(model, query), {
    type: "details",
    make: "Audi",
    model: "A4",
    chassis: "8W",
    data: { years: [2020, 2019, 2018, 2017, 2016], engines: ["ea888"] },
  });
  assert.deepEqual(selectShopCatalogFitmentFromReadModel(model, { ...query, details: false }), {
    type: "engines",
    make: "Audi",
    model: "A4",
    chassis: "8W",
    data: ["ea888"],
  });
});

test("incomplete selector artifacts fail closed for route consumers", () => {
  const model = buildShopCatalogSelectorReadModel({
    projectionVersion: 4,
    policies: [policy("p-a4", { id: "a4", make: "Audi", model: "A4" })],
    sourceCoverage: { complete: false, expectedPolicyCount: 1 },
  });
  assert.equal(
    selectShopCatalogFitmentFromReadModel(model, {
      make: null,
      model: null,
      chassis: null,
      scope: null,
      brand: null,
      details: false,
      year: null,
    }),
    null
  );
});
