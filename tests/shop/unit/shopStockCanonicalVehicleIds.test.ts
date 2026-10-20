import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { registerTestModuleHooks } from "./testHooks.mjs";

const mocks = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/canonical-vehicle-ids-mocks.mjs")
).href;
registerTestModuleHooks({
  mockUrl: mocks,
  mockedAliases: ["@/lib/prisma", "@/lib/localStorefront"],
});

const modulePromise = import("../../../src/lib/shopStockCanonicalVehicleIds.server");

const selection = {
  make: "Audi",
  model: "A5",
  chassis: "B9",
  year: null,
  engine: "DECA",
  fuel: null,
  opfGpf: null,
  scope: null,
};

test("a chassis alternate adds the canonical matches filed under that label", async () => {
  const { resolveCanonicalVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/canonical-vehicle-ids-mocks.mjs");
  mock.reset();
  // KW files the RS5 B9 under A5 B8; other suppliers tag it B9.
  mock.state.applicationsByChassis = { B9: ["apr-b9"], B8: ["kw-b8"] };

  assert.deepEqual(await resolveCanonicalVehicleProductIds(selection), ["apr-b9"]);
  assert.equal(mock.state.applicationArgs.length, 1);

  mock.reset();
  mock.state.applicationsByChassis = { B9: ["apr-b9"], B8: ["kw-b8", "apr-b9"] };
  const ids = await resolveCanonicalVehicleProductIds({
    ...selection,
    chassisAlternates: ["B8", "b9", " "],
  });
  assert.deepEqual([...(ids ?? [])].sort(), ["apr-b9", "kw-b8"]);
  // One single-chassis query per distinct label; the selection is not repeated.
  assert.deepEqual(
    mock.state.applicationArgs
      .map((args: { where: { OR: Array<{ chassisCode: { in?: string[] } }> } }) =>
        args.where.OR.flatMap((filter) => filter.chassisCode.in ?? [])
      )
      .sort(),
    [["B8"], ["B9"]]
  );
});

test("chassis alternates keep the unavailable canonical answer unavailable", async () => {
  const { resolveCanonicalVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/canonical-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.localMode = true;
  assert.equal(
    await resolveCanonicalVehicleProductIds({ ...selection, chassisAlternates: ["B8"] }),
    null
  );
  assert.equal(mock.state.applicationArgs.length, 0);
});
