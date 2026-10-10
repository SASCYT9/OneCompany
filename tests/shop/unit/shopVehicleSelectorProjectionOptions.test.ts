import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { registerTestModuleHooks } from "./testHooks.mjs";

registerTestModuleHooks({
  mockUrl: pathToFileURL(path.resolve("tests/shop/unit/fixtures/projection-options-mocks.mjs"))
    .href,
  mockedAliases: ["@/lib/prisma", "@/lib/shopCatalogProjection.server"],
});

const modulePromise = import("../../../src/lib/shopVehicleSelectorProjectionOptions.server");

function client(rows: Array<{ productId: string; code: string }>) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    $queryRaw: async (query: { sql: string; values: unknown[] }) => {
      calls.push({ sql: query.sql, values: query.values });
      return rows;
    },
  } as never;
}

test("a base model owns the chassis of its trims and a facelift makes its generation selectable", async () => {
  const { listProjectionVehicleChassisOptions } = await modulePromise;
  const fake = client([
    { productId: "a", code: "992.1" },
    { productId: "b", code: "992.2" },
    { productId: "c", code: "992" },
    { productId: "a", code: "991.2" },
    { productId: "d", code: "W 463A" },
    { productId: "e", code: "W463A" },
  ]);
  const result = await listProjectionVehicleChassisOptions(
    { make: "Porsche", model: "911", scope: "auto" },
    fake
  );
  assert.ok(result);
  assert.deepEqual(result.codes.sort(), ["991", "991.2", "992", "992.1", "992.2", "W 463A"].sort());
  assert.equal(result.counts["992"], 3);
  assert.equal(result.counts["992.1"], 1);
  assert.equal(result.counts["991"], 1);
  // `W 463A` and `W463A` are one option holding both products.
  assert.equal(result.counts["W 463A"], 2);

  const [call] = (fake as unknown as { calls: Array<{ sql: string; values: unknown[] }> }).calls;
  assert.ok(call!.values.includes("911gt3rs"), "trims of the selected base are in scope");
  // Auto is the unpartitioned catalog minus moto, not a literal `auto` key.
  assert.match(call!.sql, /"scopeKey" IS DISTINCT FROM 'moto'/);
  assert.match(call!.sql, /"verification" = 'VERIFIED'/);
});

test("empty and overflowing option reads fail closed", async () => {
  const { listProjectionVehicleChassisOptions } = await modulePromise;
  assert.equal(
    await listProjectionVehicleChassisOptions({ make: "Porsche", model: "911" }, client([])),
    null
  );
  const many = Array.from({ length: 20_000 }, (_, index) => ({
    productId: String(index),
    code: "992",
  }));
  assert.equal(
    await listProjectionVehicleChassisOptions({ make: "Porsche", model: "911" }, client(many)),
    null
  );
});

test("a trim is offered with its base model", async () => {
  const { withModelFamilyBases } = await modulePromise;
  assert.deepEqual(withModelFamilyBases("Porsche", ["911 GT3", "Cayenne"]).slice(0, 2), [
    "911 GT3",
    "Cayenne",
  ]);
  assert.ok(withModelFamilyBases("Porsche", ["911 GT3", "Cayenne"]).includes("911"));
  assert.deepEqual(withModelFamilyBases("Porsche", ["911", "911 GT3"]), ["911", "911 GT3"]);
});
