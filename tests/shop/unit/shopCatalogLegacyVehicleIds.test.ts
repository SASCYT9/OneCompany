import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { registerTestModuleHooks } from "./testHooks.mjs";

const mocks = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/legacy-vehicle-ids-mocks.mjs")
).href;
registerTestModuleHooks({
  mockUrl: mocks,
  mockedAliases: [
    "@/lib/prisma",
    "@/lib/shopFitmentCatalogServer",
    "@/lib/crossShopFitment",
    "@/lib/shopVehicleConstraints",
    "@/lib/shopSearch",
    "@/lib/shopVehicleTaxonomy",
  ],
});

const modulePromise = import("../../../src/lib/shopCatalogLegacyVehicleIds.server");

test("matches every official BMC supplier application, not only the primary vehicle", async () => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.supplierFitmentProductId = "bmc-multi-application-id";
  mock.state.productSearchIds = ["bmc-multi-application-id"];
  mock.state.supplierFitmentValue = JSON.stringify({
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    applications: [
      {
        vehicleType: "car",
        make: "Audi",
        model: "A3",
        chassisCode: null,
        yearFrom: null,
        yearTo: null,
        engine: null,
        fuel: null,
        bodyStyle: null,
        drivetrain: null,
        transmission: null,
        market: null,
        opfGpf: "unknown",
      },
      {
        vehicleType: "car",
        make: "Volkswagen",
        model: "Golf",
        chassisCode: "8",
        yearFrom: 2019,
        yearTo: null,
        engine: null,
        fuel: null,
        bodyStyle: null,
        drivetrain: null,
        transmission: null,
        market: null,
        opfGpf: "unknown",
      },
    ],
    parentSku: null,
    source: { supplier: "BMC", sourceRef: "FB409-01", sourceUpdatedAt: null },
    note: null,
  });

  const result = await resolveLegacyVehicleProductIds({
    brand: "BMC",
    make: "Volkswagen",
    model: "Golf",
  });
  assert.deepEqual(result, ["bmc-multi-application-id"]);
  assert.ok(
    mock.state.productSearchArgs.some((args: { where: { OR?: unknown } }) =>
      JSON.stringify(args.where.OR).includes('"BMC"')
    )
  );
});

test("coalesces concurrent vehicle resolutions and reuses the bounded result", async () => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  const input = { make: "BMW", model: "M5", generation: "G90", year: 2025 };
  const [first, second] = await Promise.all([
    resolveLegacyVehicleProductIds(input),
    resolveLegacyVehicleProductIds({ ...input }),
  ]);

  assert.deepEqual(first, ["fitment-id", "application-id", "projection-id"]);
  assert.strictEqual(second, first);
  assert.equal(mock.state.applicationCalls, 1);
  assert.equal(mock.state.projectionCalls, 1);
  assert.equal(mock.state.catalogCalls, 1);
  assert.equal(mock.state.metafieldCalls, 1);
  assert.deepEqual(mock.state.metafieldArgs[0].where.key.in, [
    "normalized_fitment",
    "supplier_fitment",
  ]);
  assert.equal(mock.state.applicationArgs[0].where.AND.length, 2);
  assert.equal(mock.state.applicationArgs[0].where.verificationStatus, "VERIFIED");
  // Evidence is narrowed to the selected year, model, and chassis before the
  // legacy bridge returns IDs. This keeps unrelated clauses out of the hot
  // path and makes the cache key safe for each vehicle selection.
  assert.equal(mock.state.projectionArgs[0].where.AND.length, 3);
  assert.equal(mock.state.projectionArgs[0].where.policy.mode, "VEHICLE_SPECIFIC");
  assert.equal(mock.state.projectionArgs[0].where.verification, "VERIFIED");
  assert.deepEqual(await resolveLegacyVehicleProductIds(input), first);
  assert.equal(mock.state.applicationCalls, 1);
  assert.equal(mock.state.projectionCalls, 1);
});

test("removes rejected flights so a transient lookup failure can retry", async () => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.rejectApplicationOnce = true;
  await assert.rejects(
    resolveLegacyVehicleProductIds({ make: "BMW", model: "M5" }),
    /test failure/
  );
  const result = await resolveLegacyVehicleProductIds({ make: "BMW", model: "M5" });
  assert.deepEqual(result, ["fitment-id", "application-id", "projection-id"]);
  assert.equal(mock.state.applicationCalls, 2);
});

test("legacy resolution queries both the selected family and its specific model alternate", async () => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  await resolveLegacyVehicleProductIds({
    make: "Mercedes-Benz",
    model: "G-Class",
    modelAlternates: ["AMG G 63"],
    generation: "W465",
  });

  const applicationModels = mock.state.applicationArgs[0].where.model.in;
  assert.ok(applicationModels.includes("G-Class"));
  assert.ok(applicationModels.includes("G63"));
  const clauseFilters = JSON.stringify(mock.state.projectionArgs[0].where.AND);
  assert.match(clauseFilters, /G-Class/);
  assert.match(clauseFilters, /G63/);
});

test("vehicle results expire and unrelated vehicle keys do not share answers", async (t) => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  let now = Date.now() + 120_000;
  t.mock.method(Date, "now", () => now);
  const input = { make: "BMW", model: "M5", generation: "G90", year: 2026 };
  await resolveLegacyVehicleProductIds(input);
  await resolveLegacyVehicleProductIds({ ...input, model: "m5" });
  assert.equal(mock.state.applicationCalls, 1);
  const other = await resolveLegacyVehicleProductIds({ ...input, generation: "F90" });
  assert.ok(!other?.includes("projection-id"));
  // Different chassis must not reuse evidence for the previous vehicle.
  assert.equal(mock.state.applicationCalls, 2);
  now += 60_001;
  await resolveLegacyVehicleProductIds(input);
  // The original vehicle answer expires after one minute and is refreshed.
  assert.equal(mock.state.applicationCalls, 3);
});

test("brand-dependent supplier resolution cannot reuse another brand's cached ID set", async (t) => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  t.mock.method(Date, "now", () => Date.parse("2035-01-01"));
  mock.state.productSearchIds = ["fitment-id"];
  const input = { make: "BMW", model: "M5", generation: "G90", year: 2028 };
  await resolveLegacyVehicleProductIds(input);
  const count = mock.state.productSearchArgs.length;
  await resolveLegacyVehicleProductIds({ ...input, brand: "BMC" });
  assert.ok(mock.state.productSearchArgs.length > count);
  assert.ok(
    mock.state.productSearchArgs.some((args: unknown) => JSON.stringify(args).includes('"BMC"'))
  );
});

test("a verified CHASSIS-only clause stays reachable through the generation selector", async (t) => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  t.mock.method(Date, "now", () => Date.parse("2036-01-01"));
  mock.state.projectionRows = [
    {
      productId: "chassis-only",
      constraints: [
        { dimension: "MAKE", state: "EXACT", textValue: "BMW" },
        { dimension: "MODEL", state: "EXACT", textValue: "M5" },
        { dimension: "CHASSIS", state: "EXACT", textValue: "G90" },
      ],
    },
  ];
  const ids = await resolveLegacyVehicleProductIds({ make: "BMW", model: "M5", generation: "G90" });
  assert.ok(ids?.includes("chassis-only"));
});

test("legacy bridge excludes stale projection clauses and does not turn UNKNOWN year into a wildcard", async (t) => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  t.mock.method(Date, "now", () => Date.parse("2037-01-01"));
  const constraints = [
    { dimension: "MAKE", state: "EXACT", textValue: "BMW" },
    { dimension: "MODEL", state: "EXACT", textValue: "M5" },
    { dimension: "CHASSIS", state: "EXACT", textValue: "G90" },
  ];
  mock.state.projectionRows = [
    {
      productId: "stale",
      sourceVersion: BigInt(1),
      product: { catalogProjections: [{ sourceVersion: BigInt(2) }] },
      constraints,
    },
    { productId: "any-year", constraints: [...constraints, { dimension: "YEAR", state: "ANY" }] },
    {
      productId: "unknown-year",
      constraints: [...constraints, { dimension: "YEAR", state: "UNKNOWN" }],
    },
  ];
  const ids = await resolveLegacyVehicleProductIds({
    make: "BMW",
    model: "M5",
    generation: "G90",
    year: 2029,
  });
  assert.ok(!ids?.includes("stale"));
  assert.ok(ids?.includes("any-year"));
  assert.ok(!ids?.includes("unknown-year"));
});
