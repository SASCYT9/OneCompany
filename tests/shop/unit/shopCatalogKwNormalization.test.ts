import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKwVehicleMakeEvidence,
  buildKwCompatibilityPolicy,
  buildKwNormalizedFitment,
  normalizeKwShopifyCatalog,
  normalizeKwShopifyProduct,
} from "../../../src/lib/shopCatalogKwNormalization";
import { validateShopCatalogV2CompatibilityPolicy } from "../../../src/lib/shopCatalogV2Compatibility";
import type { ShopifySnapshotProduct } from "../../../src/lib/shopifyCatalogSnapshot";

function product(id: string, tags: string[], productType = "Койловерна підвіска"): ShopifySnapshotProduct {
  return { id, vendor: "KW", tags, productType, variants: [], media: [], metafields: [] };
}

test("KW normalizer parses model, chassis, years, engines and canonical category", () => {
  const row = product("gid://shopify/Product/1", [
    "brand:BMW",
    "veh:3 (G20 G80) 11/2018-",
    "eng:320 i",
    "eng:M3 Competition xDrive",
  ]);
  const normalized = normalizeKwShopifyCatalog([row])[0]!;
  assert.equal(normalized.categoryKey, "coilovers");
  assert.deepEqual(normalized.applications, [{
    rawVehicleTag: "3 (G20 G80) 11/2018-",
    make: "BMW",
    model: "3 Series",
    chassisCodes: ["G20", "G80"],
    yearFrom: 2018,
    yearTo: null,
    engines: ["320 i", "M3 Competition xDrive"],
    verification: "VERIFIED",
  }]);
  assert.deepEqual(normalized.issues, []);
});

test("single-make evidence resolves vehicles in multi-brand products", () => {
  const evidenceRows = [
    product("p1", ["brand:CUPRA", "veh:Born (K1) 08/2021-"]),
    product("p2", ["brand:VW", "veh:ID.3 (E11 E12) 11/2019-"]),
  ];
  const target = product("p3", [
    "brand:CUPRA", "brand:VW",
    "veh:Born (K1) 08/2021-", "veh:ID.3 (E11 E12) 11/2019-",
    "eng:electric",
  ]);
  const evidence = buildKwVehicleMakeEvidence(evidenceRows);
  const normalized = normalizeKwShopifyProduct(target, evidence);
  assert.deepEqual(normalized.applications.map(({ make }) => make), ["Cupra", "Volkswagen"]);
  assert.ok(normalized.applications.every(({ engines }) => engines.length === 0));
  assert.ok(normalized.applications.every(({ verification }) => verification === "NEEDS_REVIEW"));
  assert.ok(normalized.issues.includes("engine_vehicle_correlation_ambiguous"));
  assert.equal(buildKwCompatibilityPolicy("p3", normalized).mode, "NEEDS_REVIEW");
});

test("KW HAS title supplies the missing Shopify category without inventing fitment", () => {
  const row = product("p8", ["brand:BMW", "veh:5 (G90) 07/2023-"], "");
  row.title = "Комплект пружин з регулюванням висоти KW HAS для BMW M5 (G90) 2024+";
  const normalized = normalizeKwShopifyCatalog([row])[0]!;
  assert.equal(normalized.categoryKey, "springs-and-sport-suspension");
  assert.ok(!normalized.issues.includes("category_unmapped"));
});

test("shared legacy vehicle tags expand into distinct make applications", () => {
  const row = product("p9", ["brand:CUPRA", "brand:SEAT", "veh:ATECA (5FP KH7) 04/2016-"]);
  const normalized = normalizeKwShopifyProduct(row, new Map());
  assert.deepEqual(normalized.applications.map(({ make }) => make), ["Cupra", "Seat"]);
  assert.ok(normalized.applications.every(({ verification }) => verification === "INFERRED"));
  assert.ok(!normalized.issues.includes("vehicle_make_correlation_ambiguous"));
});

test("chassis evidence separates Cupra Leon from Seat Leon", () => {
  const row = product("p10", ["brand:CUPRA", "brand:SEAT", "veh:LEON (KL1 KU1 KUG) 09/2020-"]);
  const normalized = normalizeKwShopifyProduct(row, new Map());
  assert.deepEqual(normalized.applications.map(({ make }) => make), ["Cupra"]);
});

test("unresolved multi-brand correlations are quarantined instead of cross-joined", () => {
  const target = product("p4", ["brand:AUDI", "brand:VW", "veh:UNKNOWN (X1) 01/2020-", "eng:2.0 TSI"]);
  const normalized = normalizeKwShopifyProduct(target, new Map());
  assert.equal(normalized.applications[0]!.make, null);
  assert.equal(normalized.applications[0]!.verification, "NEEDS_REVIEW");
  assert.ok(normalized.issues.includes("vehicle_make_correlation_ambiguous"));
});

test("missing vehicle tags fall back to structured Shopify brand/model metafields", () => {
  const row = product("p5", []);
  row.metafields = [
    { id: "m1", namespace: "custom", key: "brand", value: '["BMW"]' },
    { id: "m2", namespace: "custom", key: "model", value: '["5 (G60, G90) 07/2023- | 5 Touring (G61, G99) 03/2024-"]' },
  ];
  const normalized = normalizeKwShopifyCatalog([row])[0]!;
  assert.equal(normalized.applications.length, 2);
  assert.deepEqual(normalized.applications.map(({ make, chassisCodes }) => ({ make, chassisCodes })), [
    { make: "BMW", chassisCodes: ["G60", "G90"] },
    { make: "BMW", chassisCodes: ["G61", "G99"] },
  ]);
  assert.ok(!normalized.issues.includes("vehicle_tags_missing"));
});

test("multi-brand make correlation can use explicit make+model evidence in the title", () => {
  const row = product("p6", ["brand:SKODA", "brand:VW", "veh:OCTAVIA IV (NX3) 01/2020-", "eng:2.0 TSI"]);
  row.title = "Койловерна підвіска V3 — SKODA OCTAVIA IV, VW ARTEON";
  const normalized = normalizeKwShopifyProduct(row, new Map());
  assert.equal(normalized.applications[0]!.make, "Skoda");
  assert.equal(normalized.applications[0]!.verification, "INFERRED");
});

test("KW fitment becomes OR clauses without cross-joining vehicle engines", () => {
  const rows = [
    product("p7", ["brand:BMW", "veh:3 (G20 G80) 11/2018-", "eng:320 i"]),
  ];
  const normalization = normalizeKwShopifyCatalog(rows)[0]!;
  const policy = buildKwCompatibilityPolicy("local-product-id", normalization);
  assert.equal(policy.mode, "VEHICLE_SPECIFIC");
  assert.equal(policy.clauses.length, 1);
  assert.deepEqual(
    policy.clauses[0]!.constraints.find((constraint) => constraint.dimension === "engine"),
    { dimension: "engine", state: "EXACT", values: ["320 i"] }
  );
  assert.deepEqual(validateShopCatalogV2CompatibilityPolicy(policy), []);
  const metafield = buildKwNormalizedFitment(normalization);
  assert.equal(metafield.status, "verified");
  assert.equal(metafield.applications[0]!.make, "BMW");
  assert.deepEqual(metafield.applications[0]!.engines, ["320 i"]);
});
