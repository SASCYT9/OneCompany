import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAdminProductPayload } from "../../../src/lib/shopAdminCatalog";
import {
  normalizeSupplierFitmentContract,
  parseSupplierFitmentContract,
  supplierContractToNormalizedFitment,
  SUPPLIER_FITMENT_KEY,
  validateSupplierFitmentParentReference,
} from "../../../src/lib/shopImportFitment";

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
  assert.equal(result.data?.applications.length, 2);
  const normalized = supplierContractToNormalizedFitment(result.data!);
  assert.equal(normalized.source, "import");
  assert.equal(normalized.applications[0].chassisCodes[0], "991.2");
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
