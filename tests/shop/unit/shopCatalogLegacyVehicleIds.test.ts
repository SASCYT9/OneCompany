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

test("BMC supplier candidates are still loaded after the same vehicle was cached without a brand", async () => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.productSearchIds = ["bmc-brand-cache-id"];
  const vehicle = { make: "Volkswagen", model: "Golf V", year: 2007 };
  await resolveLegacyVehicleProductIds(vehicle);
  mock.state.productSearchArgs.length = 0;
  await resolveLegacyVehicleProductIds({ ...vehicle, brand: "BMC" });
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

test("legacy tag candidates use every make spelling, not only the canonical label", async () => {
  const { resolveLegacyVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.productSearchIds.push("remus-octavia");
  await resolveLegacyVehicleProductIds({ make: "Škoda", model: "Octavia" });

  // Remus rows carry only `fits-make:skoda` / `fits-model:skoda:octavia` tags.
  const candidateQuery = JSON.stringify(mock.state.productSearchArgs[0].where);
  assert.match(candidateQuery, /fits-make:skoda"/);
  assert.match(candidateQuery, /fits-model:skoda:octavia"/);

  mock.reset();
  mock.state.productSearchIds.push("svw-teramont");
  await resolveLegacyVehicleProductIds({ make: "Volkswagen", model: "Teramont" });
  // Importer slugs drop punctuation: `Volkswagen (Svw)` -> `volkswagen-svw`.
  assert.match(
    JSON.stringify(mock.state.productSearchArgs[0].where),
    /fits-model:volkswagen-svw:teramont"/
  );
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

test("products filed on a broader generation are a lower tier, facelifts of the selection are exact", async () => {
  const { resolveLegacyVehicleProductTiers } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  // Evidence is filed on `G90`; the visitor selected the facelift `G90.1`.
  const broad = await resolveLegacyVehicleProductTiers({
    make: "BMW",
    model: "M5",
    generation: "G90.1",
    year: 2025,
  });
  assert.ok(broad?.ids.includes("application-id"));
  assert.ok(broad?.ids.includes("projection-id"));
  assert.ok(!broad?.exactIds.includes("application-id"));
  assert.ok(!broad?.exactIds.includes("projection-id"));
  // The evidence queries also fetch the parent generation.
  assert.match(JSON.stringify(mock.state.applicationArgs[0].where.OR), /"equals":"G90"/);

  mock.reset();
  const exact = await resolveLegacyVehicleProductTiers({
    make: "BMW",
    model: "M5",
    generation: "G90",
    year: 2024,
  });
  assert.ok(exact?.exactIds.includes("application-id"));
  assert.ok(exact?.exactIds.includes("projection-id"));
  // Facelifts of the selected generation are fetched as well (`G90` -> `G90.1`).
  assert.match(JSON.stringify(mock.state.applicationArgs[0].where.OR), /"startsWith":"G90\./);
});

test("chassis options come from the listing's own evidence and never offer a dead end", async () => {
  const { listLegacyVehicleChassisOptions } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.productSearchIds.push("fitment-id");
  const options = await listLegacyVehicleChassisOptions({ make: "BMW", model: "M5" });
  assert.ok(options);
  assert.ok(options.codes.includes("G90"));
  assert.ok(options.codes.every((code: string) => options.counts[code] > 0));
  assert.deepEqual(Object.keys(options.counts).sort(), [...options.codes].sort());
});

test("a product whose title names the selection but its supplier table does not is a lower tier", async () => {
  const { resolveLegacyVehicleProductTiers } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.productSearchIds.push("fitment-id");
  // Supplier table: M5 only. Title: `... для BMW M5 + M8 F90-F93`.
  mock.state.supplierFitmentValue = JSON.stringify({
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    applications: [
      {
        vehicleType: "car",
        make: "BMW",
        model: "M5",
        chassisCode: "F90",
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
    ],
    parentSku: null,
    source: { supplier: "BMC", sourceRef: "SET-1", sourceUpdatedAt: null },
    note: null,
  });
  mock.state.titleFitment = {
    make: "BMW",
    models: ["M5", "M8"],
    chassisCodes: ["F90", "F93"],
    yearRanges: [],
    confidence: "high",
  };
  const m8 = await resolveLegacyVehicleProductTiers({ make: "BMW", model: "M8" });
  assert.ok(m8?.ids.includes("fitment-id"));
  assert.ok(!m8?.exactIds.includes("fitment-id"));

  // A title read with less than high confidence never adds a lower tier.
  mock.state.titleFitment = { ...mock.state.titleFitment, confidence: "medium" };
  const weak = await resolveLegacyVehicleProductTiers({ make: "BMW", model: "M8", year: 2021 });
  assert.ok(!weak?.ids.includes("fitment-id"));
});

test("a title naming several cars never pairs one model with another model's chassis", async () => {
  const { resolveLegacyVehicleProductTiers } = await modulePromise;
  const mock = await import("./fixtures/legacy-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.productSearchIds.push("fitment-id");
  mock.state.supplierFitmentValue = JSON.stringify({
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    applications: [
      {
        vehicleType: "car",
        make: "Audi",
        model: "RS6",
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
    ],
    parentSku: null,
    source: { supplier: "BMC", sourceRef: "S63", sourceUpdatedAt: null },
    note: null,
  });
  // `BMS Performance Intake для BMW F10 M5 / F12–F13 M6`
  mock.state.titleFitment = {
    make: "BMW",
    models: ["M5", "M6"],
    chassisCodes: ["F10", "F12", "F13"],
    yearRanges: [],
    confidence: "high",
  };
  mock.state.expectedChassis = { M5: ["F10", "F90"], M6: ["F06", "F12", "F13"] };
  const own = await resolveLegacyVehicleProductTiers({ make: "BMW", model: "M6", generation: "F12" });
  assert.ok(own?.ids.includes("fitment-id"));
  assert.ok(!own?.exactIds.includes("fitment-id"));
  const foreign = await resolveLegacyVehicleProductTiers({
    make: "BMW",
    model: "M6",
    generation: "F10",
  });
  assert.ok(!foreign?.ids.includes("fitment-id"));
});
