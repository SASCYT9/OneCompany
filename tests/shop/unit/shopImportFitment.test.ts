import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { normalizeAdminProductPayload } from "../../../src/lib/shopAdminCatalog";
import {
  normalizeSupplierFitmentContract,
  parseSupplierFitmentContract,
  supplierContractToNormalizedFitment,
  supplierFitmentV2ToShopCatalogV2Policy,
  SUPPLIER_FITMENT_DIMENSIONS,
  SUPPLIER_FITMENT_KEY,
  SUPPLIER_FITMENT_V2_VERSION,
  upgradeSupplierFitmentContractToV2,
  validateSupplierFitmentParentReference,
} from "../../../src/lib/shopImportFitment";
import {
  normalizeLegacyShopCatalogV2Query,
  strictMatchShopCatalogV2Compatibility,
} from "../../../src/lib/shopCatalogV2Compatibility";

const source = { supplier: "GiroDisc", sourceRef: "catalog:2026-07" };

test("vehicle applications are atomic and preserve correlation", () => {
  const result = normalizeSupplierFitmentContract({
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    source,
    applications: [
      {
        vehicleType: "car",
        make: "Porsche",
        model: "911 Turbo",
        chassisCode: "991.2",
        yearFrom: 2017,
        yearTo: 2019,
        engine: "9A1",
        fuel: "petrol",
        transmission: "PDK",
        opfGpf: "without",
      },
      {
        vehicleType: "car",
        make: "Porsche",
        model: "911 Turbo",
        chassisCode: "992",
        yearFrom: 2020,
        yearTo: null,
      },
    ],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.data?.version, 1);
  assert.ok(result.data?.version === 1);
  assert.equal(result.data.applications.length, 2);
  const normalized = supplierContractToNormalizedFitment(result.data);
  assert.equal(normalized.source, "import");
  assert.equal(normalized.status, "verified");
  assert.equal(normalized.applications[0].chassisCodes[0], "991.2");
  assert.equal(result.data.applications[0].fuel, "petrol");
  assert.equal(normalized.applications[0].fuel, "petrol");
  assert.equal(normalized.applications[0].transmission, "PDK");
  assert.equal(normalized.applications[0].opfGpf, "without");
  assert.equal(normalized.applications[1].yearRanges[0].from, 2020);
});

test("parent-dependent components require a parent SKU and reject direct vehicles", () => {
  const invalid = normalizeSupplierFitmentContract({
    version: 1,
    mode: "parent_dependent",
    scope: "auto",
    source,
    applications: [{ vehicleType: "car", make: "BMW", model: "M3" }],
  });

  assert.equal(invalid.data, null);
  assert.equal(
    invalid.errors.some((error) => error.code === "MISSING_PARENT_SKU"),
    true
  );
  assert.equal(
    invalid.errors.some((error) => error.code === "UNEXPECTED_APPLICATION"),
    true
  );
});

test("scope mismatches and invalid years fail before import", () => {
  const invalid = normalizeSupplierFitmentContract({
    version: 1,
    mode: "vehicle_specific",
    scope: "moto",
    source,
    applications: [
      {
        vehicleType: "car",
        make: "BMW",
        model: "M3",
        yearFrom: 2024,
        yearTo: 2020,
      },
    ],
  });

  assert.equal(invalid.data, null);
  assert.equal(
    invalid.errors.some((error) => error.code === "SCOPE_MISMATCH"),
    true
  );
  assert.equal(
    invalid.errors.some((error) => error.code === "INVALID_YEAR_RANGE"),
    true
  );
});

test("admin imports persist only validated supplier fitment contracts", () => {
  const result = normalizeAdminProductPayload({
    slug: "girodisc-d1-264",
    titleUa: "Змінне кільце GiroDisc",
    titleEn: "GiroDisc replacement ring",
    brand: "GiroDisc",
    fitment: {
      version: 1,
      mode: "parent_dependent",
      scope: "auto",
      parentSku: "A1-264",
      source,
      applications: [],
    },
  });

  assert.deepEqual(result.errors, []);
  const metafield = result.data.metafields.find((item) => item.key === SUPPLIER_FITMENT_KEY);
  assert.ok(metafield);
  const parsed = parseSupplierFitmentContract(metafield.value);
  assert.equal(parsed?.mode, "parent_dependent");
  assert.equal(parsed?.parentSku, "A1-264");
});

test("invalid fitment contract rejects the product row", () => {
  const result = normalizeAdminProductPayload({
    slug: "unsafe-product",
    titleEn: "Unsafe product",
    fitment: {
      version: 1,
      mode: "vehicle_specific",
      scope: "auto",
      source: { supplier: "Unknown" },
      applications: [],
    },
  });

  assert.equal(
    result.errors.some((error) => error.includes("MISSING_SOURCE")),
    true
  );
  assert.equal(
    result.errors.some((error) => error.includes("MISSING_APPLICATION")),
    true
  );
});

test("parent-dependent import rejects orphan parent SKUs", () => {
  const contract = normalizeSupplierFitmentContract({
    version: 1,
    mode: "parent_dependent",
    scope: "auto",
    parentSku: "A1-264",
    source,
    applications: [],
  }).data!;

  assert.deepEqual(validateSupplierFitmentParentReference(contract, ["A1-264"]), []);
  assert.equal(
    validateSupplierFitmentParentReference(contract, ["A1-999"])[0]?.code,
    "MISSING_PARENT_SKU"
  );
});

test("schema drift and invalid supplier dates are rejected", () => {
  const result = normalizeSupplierFitmentContract({
    version: 1,
    mode: "universal",
    scope: "auto",
    applications: [],
    legacyModels: ["M3"],
    source: {
      ...source,
      sourceUpdatedAt: "not-a-date",
      legacyUrl: "https://supplier.invalid",
    },
  });

  assert.equal(result.data, null);
  assert.equal(result.errors.filter((error) => error.code === "UNKNOWN_FIELD").length, 2);
  assert.equal(
    result.errors.some((error) => error.code === "INVALID_SOURCE_DATE"),
    true
  );
});

type Dimension = (typeof SUPPLIER_FITMENT_DIMENSIONS)[number];
type ExactValues = Array<string | { from: number | null; to: number | null }>;
type NonExactState = "ANY" | "NOT_APPLICABLE" | "UNKNOWN";

const v2Source = {
  supplier: "Golden supplier",
  sourceRef: "catalog:2026-08",
  sourceUpdatedAt: "2026-08-31T00:00:00.000Z",
  sourceKey: "golden-supplier",
  sourceRecordKey: "golden-row-1",
  sourceRevision: "42",
  payloadHash: "a".repeat(64),
  mapperVersion: "golden/2",
};

function constraints(
  exact: Partial<Record<Dimension, ExactValues>>,
  states: Partial<Record<Dimension, NonExactState>> = {}
) {
  return SUPPLIER_FITMENT_DIMENSIONS.map((dimension) =>
    exact[dimension]
      ? { dimension, state: "EXACT" as const, values: exact[dimension] }
      : { dimension, state: states[dimension] ?? "UNKNOWN" }
  );
}

function clause(
  id: string,
  clauseConstraints: ReturnType<typeof constraints>,
  verification: "VERIFIED" | "INFERRED" | "NEEDS_REVIEW" = "VERIFIED"
) {
  return {
    id,
    constraints: clauseConstraints,
    verification,
    provenance: {
      sourceRef: v2Source.sourceRef,
      sourceRecordKey: v2Source.sourceRecordKey,
      rawPaths: [`rows.${id}`],
      evidenceRefs: [],
    },
  };
}

function v2Contract(clauses: ReturnType<typeof clause>[], requiredDimensions: Dimension[] = []) {
  return {
    version: SUPPLIER_FITMENT_V2_VERSION,
    mode: "vehicle_specific" as const,
    scope: "auto" as const,
    policy: { requiredDimensions, clauses },
    parentSku: null,
    source: v2Source,
    note: null,
  };
}

test("pure V1 to V2 upgrade preserves atomic rows and maps nulls to UNKNOWN", () => {
  const legacy = normalizeSupplierFitmentContract({
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    source,
    note: "RaceChip source row",
    applications: [
      {
        vehicleType: "car",
        make: "BMW",
        model: "M3",
        chassisCode: "G80",
        engine: null,
        fuel: null,
        transmission: "AT",
      },
    ],
  });
  assert.deepEqual(legacy.errors, []);
  assert.ok(legacy.data?.version === 1);

  const upgraded = upgradeSupplierFitmentContractToV2(legacy.data);
  assert.equal(upgraded.policy.clauses.length, legacy.data.applications.length);
  assert.equal(upgraded.policy.clauses[0].verification, "NEEDS_REVIEW");
  assert.equal(upgraded.policy.clauses[0].constraints.length, 13);
  assert.equal(
    upgraded.policy.clauses[0].constraints.find((item) => item.dimension === "engine")?.state,
    "UNKNOWN"
  );
  assert.equal(
    upgraded.policy.clauses[0].constraints.find((item) => item.dimension === "fuel")?.state,
    "UNKNOWN"
  );
  assert.equal(upgraded.source.sourceRecordKey, source.sourceRef);
  assert.equal(upgraded.source.mapperVersion, "supplier-fitment-v1-adapter/2");
  assert.deepEqual(normalizeSupplierFitmentContract(upgraded).errors, []);
});

test("only explicit V1 universal mode upgrades missing dimensions to ANY", () => {
  const universal = normalizeSupplierFitmentContract({
    version: 1,
    mode: "universal",
    scope: "auto",
    applications: [],
    source,
  });
  assert.ok(universal.data?.version === 1);
  const upgradedUniversal = upgradeSupplierFitmentContractToV2(universal.data);
  assert.equal(upgradedUniversal.policy.clauses.length, 1);
  assert.equal(
    upgradedUniversal.policy.clauses[0].constraints.find((item) => item.dimension === "engine")
      ?.state,
    "ANY"
  );
  assert.equal(
    supplierFitmentV2ToShopCatalogV2Policy(upgradedUniversal, { productId: "universal-kit" })?.mode,
    "UNIVERSAL"
  );
  const universalPolicy = supplierFitmentV2ToShopCatalogV2Policy(upgradedUniversal, {
    productId: "universal-kit",
  });
  assert.ok(universalPolicy);
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      universalPolicy,
      normalizeLegacyShopCatalogV2Query({ scope: "auto", make: "BMW", engine: "S58" })
    ).status,
    "exact"
  );

  const parent = normalizeSupplierFitmentContract({
    version: 1,
    mode: "parent_dependent",
    scope: "auto",
    parentSku: "PARENT-1",
    applications: [],
    source,
  });
  assert.ok(parent.data?.version === 1);
  const upgradedParent = upgradeSupplierFitmentContractToV2(parent.data);
  assert.equal(upgradedParent.parentSku, "PARENT-1");
  assert.deepEqual(upgradedParent.policy.clauses, []);
  assert.deepEqual(normalizeSupplierFitmentContract(upgradedParent).errors, []);
  assert.equal(
    supplierFitmentV2ToShopCatalogV2Policy(upgradedParent, { productId: "child-part" }),
    null
  );
  const resolvedParent = supplierFitmentV2ToShopCatalogV2Policy(
    upgradedParent,
    { productId: "child-part" },
    { productId: "canonical-parent", variantId: "canonical-parent-red" }
  );
  assert.ok(resolvedParent);
  assert.equal(resolvedParent.mode, "PARENT_DEPENDENT");
  assert.deepEqual(resolvedParent.parentTarget, {
    productId: "canonical-parent",
    variantId: "canonical-parent-red",
  });
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      resolvedParent,
      normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M2", engine: "S58" })
    ).status,
    "requires_verification"
  );
});

test("ADRO V2 can explicitly mark engine not applicable without a brand rule", () => {
  const contract = v2Contract(
    [
      clause(
        "adro-g80",
        constraints(
          {
            scope: ["auto"],
            make: ["bmw"],
            model: ["m3"],
            generation: ["g8x"],
            chassis: ["g80"],
            year: [{ from: 2021, to: null }],
            bodyStyle: ["sedan"],
          },
          {
            engine: "NOT_APPLICABLE",
            fuel: "NOT_APPLICABLE",
            drivetrain: "ANY",
            transmission: "ANY",
            market: "ANY",
            opfGpf: "ANY",
          }
        )
      ),
    ],
    ["make", "model", "chassis"]
  );
  const parsed = normalizeSupplierFitmentContract(contract);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.data?.version === 2);
  const policy = supplierFitmentV2ToShopCatalogV2Policy(parsed.data, {
    productId: "adro-g80-front-lip",
  });
  assert.ok(policy);
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({
        make: "BMW",
        model: "M3",
        chassis: "G80",
        engine: "S58",
      })
    ).status,
    "exact"
  );
});

test("Eventuri V2 keeps OR clauses correlated instead of creating a Cartesian match", () => {
  const sharedStates: Partial<Record<Dimension, NonExactState>> = {
    generation: "ANY",
    year: "ANY",
    engine: "NOT_APPLICABLE",
    fuel: "NOT_APPLICABLE",
    bodyStyle: "ANY",
    drivetrain: "ANY",
    transmission: "ANY",
    market: "ANY",
    opfGpf: "ANY",
  };
  const contract = v2Contract(
    [
      clause(
        "eventuri-m2-f87",
        constraints(
          { scope: ["auto"], make: ["bmw"], model: ["m2"], chassis: ["f87"] },
          sharedStates
        )
      ),
      clause(
        "eventuri-m3-g80",
        constraints(
          { scope: ["auto"], make: ["bmw"], model: ["m3"], chassis: ["g80"] },
          sharedStates
        )
      ),
    ],
    ["make", "model", "chassis"]
  );
  const parsed = normalizeSupplierFitmentContract(contract);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.data?.version === 2);
  const policy = supplierFitmentV2ToShopCatalogV2Policy(parsed.data, {
    productId: "eventuri-platform",
  });
  assert.ok(policy);
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M2", chassis: "F87" })
    ).status,
    "exact"
  );
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M2", chassis: "G80" })
    ).status,
    "no_match"
  );
});

test("RaceChip V2 requires correlated engine and fuel and can project verified safely", () => {
  const contract = v2Contract(
    [
      clause(
        "racechip-g87-s58",
        constraints(
          {
            scope: ["auto"],
            make: ["bmw"],
            model: ["m2"],
            chassis: ["g87"],
            year: [{ from: 2023, to: null }],
            engine: ["s58b30t0"],
            fuel: ["petrol"],
          },
          {
            generation: "ANY",
            bodyStyle: "ANY",
            drivetrain: "ANY",
            transmission: "ANY",
            market: "ANY",
            opfGpf: "ANY",
          }
        )
      ),
    ],
    ["make", "model", "chassis", "engine", "fuel"]
  );
  const parsed = normalizeSupplierFitmentContract(contract);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.data?.version === 2);
  const policy = supplierFitmentV2ToShopCatalogV2Policy(parsed.data, {
    productId: "racechip-g87",
    variantId: "racechip-g87-s58",
  });
  assert.ok(policy);
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({ make: "BMW", model: "M2", chassis: "G87" })
    ).status,
    "requires_input"
  );
  assert.equal(
    strictMatchShopCatalogV2Compatibility(
      policy,
      normalizeLegacyShopCatalogV2Query({
        make: "BMW",
        model: "M2",
        chassis: "G87",
        engine: "S58B30T0",
        fuel: "petrol",
      })
    ).status,
    "exact"
  );
  assert.equal(supplierContractToNormalizedFitment(parsed.data).status, "verified");
});

test("V2 fail-closes inferred and UNKNOWN clauses in the legacy normalized projection", () => {
  const inferred = v2Contract([
    clause(
      "inferred",
      constraints(
        { scope: ["auto"], make: ["bmw"], model: ["m2"] },
        Object.fromEntries(
          SUPPLIER_FITMENT_DIMENSIONS.filter(
            (dimension) => !["scope", "make", "model"].includes(dimension)
          ).map((dimension) => [dimension, "ANY"])
        ) as Partial<Record<Dimension, NonExactState>>
      ),
      "INFERRED"
    ),
  ]);
  const inferredParsed = normalizeSupplierFitmentContract(inferred);
  assert.ok(inferredParsed.data?.version === 2);
  assert.equal(supplierContractToNormalizedFitment(inferredParsed.data).status, "needs_review");

  const unknown = structuredClone(inferred);
  unknown.policy.clauses[0].verification = "VERIFIED";
  const engine = unknown.policy.clauses[0].constraints.find((item) => item.dimension === "engine");
  assert.ok(engine);
  Object.assign(engine, { state: "UNKNOWN" });
  const unknownParsed = normalizeSupplierFitmentContract(unknown);
  assert.ok(unknownParsed.data?.version === 2);
  assert.equal(supplierContractToNormalizedFitment(unknownParsed.data).status, "needs_review");

  const unsafeUniversal = {
    ...v2Contract(
      [
        clause(
          "unsafe-universal",
          constraints(
            { scope: ["auto"] },
            Object.fromEntries(
              SUPPLIER_FITMENT_DIMENSIONS.filter((dimension) => dimension !== "scope").map(
                (dimension) => [dimension, "ANY"]
              )
            ) as Partial<Record<Dimension, NonExactState>>
          )
        ),
      ],
      ["engine"]
    ),
    mode: "universal" as const,
  };
  const unsafeUniversalResult = normalizeSupplierFitmentContract(unsafeUniversal);
  assert.equal(unsafeUniversalResult.data, null);
  assert.ok(
    unsafeUniversalResult.errors.some(
      (error) => error.code === "INVALID_POLICY" && error.path === "policy.requiredDimensions"
    )
  );
});

test("V2 rejects missing, duplicate, and scope-crossed constraints", () => {
  const valid = v2Contract([
    clause(
      "valid",
      constraints(
        { scope: ["auto"], make: ["bmw"], model: ["m2"] },
        Object.fromEntries(
          SUPPLIER_FITMENT_DIMENSIONS.filter(
            (dimension) => !["scope", "make", "model"].includes(dimension)
          ).map((dimension) => [dimension, "ANY"])
        ) as Partial<Record<Dimension, NonExactState>>
      )
    ),
  ]);

  const missing = structuredClone(valid);
  missing.policy.clauses[0].constraints = missing.policy.clauses[0].constraints.filter(
    (item) => item.dimension !== "engine"
  );
  assert.equal(
    normalizeSupplierFitmentContract(missing).errors.some(
      (error) => error.code === "MISSING_CONSTRAINT"
    ),
    true
  );

  const duplicate = structuredClone(valid);
  const engine = duplicate.policy.clauses[0].constraints.find(
    (item) => item.dimension === "engine"
  );
  assert.ok(engine);
  engine.dimension = "model";
  const duplicateResult = normalizeSupplierFitmentContract(duplicate);
  assert.equal(
    duplicateResult.errors.some((error) => error.code === "DUPLICATE_CONSTRAINT"),
    true
  );
  assert.equal(
    duplicateResult.errors.some((error) => error.code === "MISSING_CONSTRAINT"),
    true
  );

  const scopeMismatch = structuredClone(valid);
  const scopeConstraint = scopeMismatch.policy.clauses[0].constraints.find(
    (item) => item.dimension === "scope"
  );
  assert.ok(scopeConstraint && scopeConstraint.state === "EXACT");
  scopeConstraint.values = ["moto"];
  assert.equal(
    normalizeSupplierFitmentContract(scopeMismatch).errors.some(
      (error) => error.code === "SCOPE_MISMATCH"
    ),
    true
  );
});

test("V1 and V2 JSON schemas are separate, strict, and share the 13 dimensions", () => {
  const v1Schema = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "src", "data", "shop-fitment-import.schema.json"),
      "utf8"
    )
  );
  const v2Schema = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "src", "data", "shop-fitment-import-v2.schema.json"),
      "utf8"
    )
  );

  assert.equal(v1Schema.properties.version.const, 1);
  assert.equal(v2Schema.properties.version.const, 2);
  assert.equal(v2Schema.additionalProperties, false);
  assert.equal(v2Schema.$defs.dimension.enum.length, 13);
  assert.equal(v2Schema.$defs.constraints.minItems, 13);
  assert.equal(v2Schema.$defs.constraints.maxItems, 13);
  assert.deepEqual(v2Schema.$defs.nonExactConstraint.properties.state.enum, [
    "ANY",
    "NOT_APPLICABLE",
    "UNKNOWN",
  ]);
});
