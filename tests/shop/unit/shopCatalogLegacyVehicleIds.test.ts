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
