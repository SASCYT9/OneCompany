import assert from "node:assert/strict";
import { registerHooks } from "./testHooks.mjs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { NormalizedFitment } from "../../../src/lib/shopFitmentQuality";
import type { SupplierFitmentV2Contract } from "../../../src/lib/shopImportFitment";

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

test("supplier V2 projection preserves verified model clauses and unknown constraints", async () => {
  const { buildShopCatalogProjectionSourceFromAdminRecord } = await snapshotModule;
  const { SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS, strictMatchShopCatalogV2Compatibility } =
    await import("../../../src/lib/shopCatalogV2Compatibility");
  const sourceRef = "https://www.do88performance.eu/en/artiklar/do88-vag-ea888-sai-air-filter.html";
  const contract: SupplierFitmentV2Contract = {
    version: 2, mode: "vehicle_specific", scope: "auto", parentSku: null,
    policy: { requiredDimensions: [], clauses: [{
      id: "passat-b8", verification: "VERIFIED",
      constraints: SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.map((dimension) => {
        if (dimension === "scope") return { dimension, state: "EXACT", values: ["auto"] };
        if (dimension === "make") return { dimension, state: "EXACT", values: ["Volkswagen"] };
        if (dimension === "model") return { dimension, state: "EXACT", values: ["Passat"] };
        if (dimension === "generation") return { dimension, state: "EXACT", values: ["B8"] };
        return { dimension, state: "UNKNOWN" };
      }),
      provenance: { sourceRef, sourceRecordKey: "LF-190-SAI-KIT", rawPaths: ["Fits model"], evidenceRefs: [sourceRef] },
    }] },
    source: { supplier: "do88", sourceKey: "do88", sourceRef, sourceRecordKey: "LF-190-SAI-KIT", sourceUpdatedAt: null, sourceRevision: null, payloadHash: null, mapperVersion: "test/1" },
    note: "SAI-equipped cars with a do88 V2 intake only",
  };
  const record = {
    id: "sai-product", brand: "DO88", scope: "auto", sku: "LF-190-SAI-KIT", slug: "do88-lf-190-sai-kit",
    metafields: [{ namespace: "onecompany", key: "supplier_fitment", value: JSON.stringify(contract) }],
    variants: [], options: [], media: [], tags: [], collections: [],
  } as unknown as Parameters<typeof buildShopCatalogProjectionSourceFromAdminRecord>[0];
  const source = buildShopCatalogProjectionSourceFromAdminRecord(record, "2", 0);
  const policy = source.compatibilityPolicies![0];
  assert.equal(policy.clauses[0].verification, "VERIFIED");
  assert.equal(policy.clauses[0].constraints.find((item) => item.dimension === "fuel")?.state, "UNKNOWN");
  assert.equal(strictMatchShopCatalogV2Compatibility(policy, { make: "Volkswagen", model: "Passat", generation: "B8" }).status, "exact");
  assert.notEqual(strictMatchShopCatalogV2Compatibility(policy, { make: "Volkswagen", model: "Passat", fuel: "diesel" }).status, "exact");
  assert.notEqual(strictMatchShopCatalogV2Compatibility(policy, { make: "BMW", model: "M3" }).status, "exact");
});

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
