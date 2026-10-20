import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildShopCatalogVehicleSearchPlan } from "../../../src/lib/shopCatalogVehicleSearchPlan";
import { registerTestModuleHooks } from "./testHooks.mjs";

const mocks = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/canonical-vehicle-ids-mocks.mjs")
).href;
registerTestModuleHooks({
  mockUrl: mocks,
  mockedAliases: ["@/lib/prisma", "@/lib/localStorefront"],
});

const modulePromise = import("../../../src/lib/shopStockCanonicalVehicleIds.server");

/** The canonical resolver input stock search builds from a selector URL. */
function canonicalInput(query: string) {
  const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams(query));
  assert.equal(plan.canonical, true, query);
  return {
    make: plan.constraints.make ?? "",
    model: plan.constraints.model ?? "",
    modelAlternates: plan.modelAlternates,
    chassis: plan.constraints.generation ?? "",
    chassisAlternates: plan.generationAlternates,
    year: plan.constraints.year,
    engine: plan.constraints.engine,
    fuel: plan.constraints.fuel,
    opfGpf: plan.constraints.opfGpf,
    scope: null,
  };
}

const sorted = (ids: string[] | null) => [...(ids ?? [])].sort();

test("a chassis alternate adds the canonical matches filed under that label", async () => {
  const { resolveCanonicalVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/canonical-vehicle-ids-mocks.mjs");
  mock.reset();
  // KW files the RS5 B9 under A5 B8; other suppliers tag it RS5 B9.
  mock.state.applications = [
    { productId: "apr-b9", model: "RS5", chassis: "B9" },
    { productId: "kw-b8", model: "A5", chassis: "B8" },
  ];
  const input = canonicalInput("make=Audi&model=RS5&chassis=B9&engine=DECA");

  assert.deepEqual(await resolveCanonicalVehicleProductIds({ ...input, chassisAlternates: null }), [
    "apr-b9",
  ]);
  assert.equal(mock.state.applicationArgs.length, 1);

  mock.state.applicationArgs.length = 0;
  const ids = await resolveCanonicalVehicleProductIds({
    ...input,
    chassisAlternates: ["B8", "b9", " "],
  });
  assert.deepEqual(sorted(ids), ["apr-b9", "kw-b8"]);
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

test("RS5 B9 with an engine or fuel keeps products stored as model RS5", async () => {
  const { resolveCanonicalVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/canonical-vehicle-ids-mocks.mjs");
  for (const query of [
    "make=Audi&model=RS5&chassis=B9&engine=DECA",
    "make=Audi&model=RS5&chassis=B9&fuel=petrol",
  ]) {
    mock.reset();
    mock.state.applications = [{ productId: "apr-application", model: "RS5", chassis: "B9" }];
    mock.state.clauses = [{ productId: "apr-clause", model: "RS5", chassis: "B9" }];
    const input = canonicalInput(query);
    // The plan files RS5 under its A5 family and keeps RS5 as an alternate.
    assert.equal(input.model, "A5", query);

    assert.deepEqual(
      sorted(await resolveCanonicalVehicleProductIds(input)),
      ["apr-application", "apr-clause"],
      query
    );
    // Both reads still apply the powertrain constraint.
    for (const args of mock.state.applicationArgs) {
      assert.ok(args.where.engine || args.where.fuel, query);
    }
    for (const args of mock.state.clauseArgs) {
      assert.match(JSON.stringify(args.where.AND), /"(?:ENGINE|FUEL)"/, query);
    }

    // The A5 family alone never names RS5: this is what dropping the alternate lost.
    mock.state.applicationArgs.length = 0;
    mock.state.clauseArgs.length = 0;
    assert.deepEqual(
      await resolveCanonicalVehicleProductIds({ ...input, modelAlternates: [] }),
      [],
      query
    );
  }
});

test("stock search hands the plan's alternates to the canonical resolver", () => {
  const source = readFileSync("src/lib/shopStockSearch.server.ts", "utf8");
  const call = source.slice(source.indexOf("resolveCanonicalVehicleProductIds({"));
  const args = call.slice(0, call.indexOf("})"));
  assert.match(args, /modelAlternates: queryVehiclePlan\.modelAlternates/);
  assert.match(args, /chassisAlternates: queryVehiclePlan\.generationAlternates/);
});

test("chassis alternates keep the unavailable canonical answer unavailable", async () => {
  const { resolveCanonicalVehicleProductIds } = await modulePromise;
  const mock = await import("./fixtures/canonical-vehicle-ids-mocks.mjs");
  mock.reset();
  mock.state.localMode = true;
  assert.equal(
    await resolveCanonicalVehicleProductIds(
      canonicalInput("make=Audi&model=RS5&chassis=B9&engine=DECA")
    ),
    null
  );
  assert.equal(mock.state.applicationArgs.length, 0);
});
