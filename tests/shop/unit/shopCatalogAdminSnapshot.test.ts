import assert from "node:assert/strict";
import { registerHooks } from "./testHooks.mjs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { NormalizedFitment } from "../../../src/lib/shopFitmentQuality";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const snapshotModule = import("../../../src/lib/shopCatalogAdminSnapshot.server");

function fitment(status: "verified" | "inferred" = "verified"): NormalizedFitment {
  return {
    version: 2,
    status,
    vehicleType: "car",
    make: "BMW",
    models: ["M3"],
    chassisCodes: ["G80"],
    yearRanges: [{ from: 2021, to: null }],
    applications: [
      {
        vehicleType: "car",
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["G80"],
        yearRanges: [{ from: 2021, to: null }],
        engines: ["S58"],
        fuel: "petrol",
        bodyStyles: ["sedan"],
        drivetrains: ["awd"],
        markets: ["EU"],
        transmission: "automatic",
        opfGpf: "with",
      },
    ],
    confidence: "high",
    source: "manual",
    verifiedAt: "2026-08-31T00:00:00.000Z",
    verifiedBy: "admin@onecompany.global",
    note: null,
    dependency: null,
  };
}

test("admin snapshot maps every normalized application dimension into one correlated clause", async () => {
  const { compatibilityPolicyFromNormalizedFitment } = await snapshotModule;
  const policy = compatibilityPolicyFromNormalizedFitment("product-1", fitment());
  assert.equal(policy.mode, "VEHICLE_SPECIFIC");
  assert.equal(policy.clauses.length, 1);
  assert.equal(policy.clauses[0]?.verification, "VERIFIED");
  assert.deepEqual(
    policy.clauses[0]?.constraints.map((constraint) => constraint.dimension),
    [
      "scope",
      "make",
      "model",
      "generation",
      "chassis",
      "year",
      "engine",
      "fuel",
      "bodyStyle",
      "drivetrain",
      "transmission",
      "market",
      "opfGpf",
    ]
  );
});

test("admin snapshot fails closed when fitment is absent and preserves universal policy", async () => {
  const [{ compatibilityPolicyFromNormalizedFitment }, { validateShopCatalogV2CompatibilityPolicy }] =
    await Promise.all([
      snapshotModule,
      import("../../../src/lib/shopCatalogV2Compatibility"),
    ]);
  assert.equal(compatibilityPolicyFromNormalizedFitment("missing", null).mode, "NEEDS_REVIEW");
  const universalFitment = {
    ...fitment(),
    status: "universal" as const,
    vehicleType: "universal" as const,
    make: null,
    models: [],
    chassisCodes: [],
    yearRanges: [],
    applications: [],
  };
  const autoPolicy = compatibilityPolicyFromNormalizedFitment("universal-auto", universalFitment);
  assert.equal(autoPolicy.mode, "UNIVERSAL");
  assert.equal(autoPolicy.clauses.length, 1);
  assert.deepEqual(validateShopCatalogV2CompatibilityPolicy(autoPolicy), []);
  const motoPolicy = compatibilityPolicyFromNormalizedFitment("universal-moto", universalFitment, "moto");
  assert.deepEqual(validateShopCatalogV2CompatibilityPolicy(motoPolicy), []);
  assert.deepEqual(motoPolicy.clauses[0]?.constraints[0], {
    dimension: "scope",
    state: "EXACT",
    values: ["moto"],
  });
});
