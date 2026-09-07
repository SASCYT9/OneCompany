import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
const mocks = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/premium-projection-mocks.mjs")
).href;
const mockedAliases = new Set([
  "@/lib/shopAdminSettings",
  "@/lib/shopCatalogCardPricing.server",
  "@/lib/shopCatalogProjectionQuery.server",
  "@/lib/shopKwCardPresentation",
  "@/lib/shopCustomerSession",
  "@/lib/shopPriceConversion",
  "@/lib/shopPricingContext.server",
  "@/lib/shopPricingAudience",
  "@/lib/shopStorefrontRouting",
  "@/lib/prisma",
  "@/lib/shopCatalogLegacyVehicleIds.server",
  "@/lib/shopEuropePricing",
  "@/lib/shopWarehouseInventory",
  "@/lib/eventuriSharedIntake",
  "@/lib/shopProductDisplayBrand",
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    if (
      mockedAliases.has(specifier) ||
      [...mockedAliases].some((alias) => specifier.endsWith(alias.slice(1)))
    )
      return { url: mocks, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const modulePromise = import("../../../src/lib/shopCatalogPremiumProjection.server");

function params(values: Record<string, string>) {
  return new URLSearchParams({ locale: "en", ...values });
}

test("projection vehicle reader makes one native constraint query and no legacy resolution", async () => {
  const { queryPremiumCatalogProjection } = await modulePromise;
  const mock = await import("./fixtures/premium-projection-mocks.mjs");
  mock.reset();
  const oldMode = process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
  process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE = "projection";
  try {
    const response = await queryPremiumCatalogProjection(
      params({
        make: "BMW",
        model: "M5",
        generation: "G90",
        year: "2025",
        stock: "inStock",
        q: "intake",
        minPrice: "100",
        maxPrice: "500",
        currency: "EUR",
      })
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Server-Timing") ?? "", /reader;desc=native/);
    assert.equal(mock.state.legacyCalls, 0);
    assert.equal(mock.state.queries.length, 1);
    assert.equal(mock.state.facetQueries.length, 1);
    assert.equal(mock.state.countQueries.length, 1);
    for (const query of [
      ...mock.state.queries,
      ...mock.state.facetQueries,
      ...mock.state.countQueries,
    ]) {
      assert.equal(query.make, "BMW");
      assert.equal(query.model, "M5");
      assert.equal(query.generation, "G90");
      assert.equal(query.year, 2025);
      assert.deepEqual(query.productIds, ["warehouse-a", "warehouse-b", "shared-duplicate"]);
      assert.deepEqual(query.excludeProductIds, ["shared-duplicate"]);
      assert.equal(query.minPrice, 100);
      assert.equal(query.maxPrice, 500);
      assert.equal(query.priceCurrency, "EUR");
    }
    assert.equal(mock.state.productFindManyCalls, 1);
    assert.equal(mock.state.settingsCalls, 1);
    assert.equal((await response.json()).meta.source, "catalog_v2_projection");
  } finally {
    if (oldMode === undefined) delete process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
    else process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE = oldMode;
  }
});

test("legacy vehicle reader resolves once and restricts the projection to returned IDs", async () => {
  const { queryPremiumCatalogProjection } = await modulePromise;
  const mock = await import("./fixtures/premium-projection-mocks.mjs");
  mock.reset();
  const oldMode = process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
  delete process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
  try {
    await queryPremiumCatalogProjection(
      params({ make: "BMW", model: "M5", generation: "G90", year: "2025" })
    );
    assert.equal(mock.state.legacyCalls, 1);
    assert.equal(mock.state.queries[0]?.productIds?.[0], "legacy-id");
    assert.equal(mock.state.queries[0]?.make, null);
    assert.equal(mock.state.facetQueries[0]?.productIds?.[0], "legacy-id");
    assert.equal(mock.state.countQueries[0]?.productIds?.[0], "legacy-id");
  } finally {
    if (oldMode === undefined) delete process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
    else process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE = oldMode;
  }
});

test("pre-order selection excludes warehouse products in native and legacy queries", async () => {
  const { queryPremiumCatalogProjection } = await modulePromise;
  const mock = await import("./fixtures/premium-projection-mocks.mjs");
  const oldMode = process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
  try {
    for (const mode of ["projection", "legacy"]) {
      mock.reset();
      process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE = mode;
      await queryPremiumCatalogProjection(params({ make: "BMW", model: "M5", stock: "preOrder" }));
      for (const query of [
        ...mock.state.queries,
        ...mock.state.facetQueries,
        ...mock.state.countQueries,
      ]) {
        assert.deepEqual(
          new Set(query.excludeProductIds),
          new Set(["warehouse-a", "warehouse-b", "shared-duplicate"])
        );
        assert.deepEqual(query.productIds, mode === "legacy" ? ["legacy-id"] : undefined);
        assert.equal(query.make, mode === "legacy" ? null : "BMW");
      }
    }
  } finally {
    if (oldMode === undefined) delete process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
    else process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE = oldMode;
  }
});

test("native auto, moto and engine/fuel/OPF queries never build legacy ID lists", async () => {
  const { queryPremiumCatalogProjection } = await modulePromise;
  const mock = await import("./fixtures/premium-projection-mocks.mjs");
  const oldMode = process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
  const cases = [
    {
      mode: "projection",
      query: "locale=ua&make=BMW&model=M5&chassis=G90&year=2025",
      model: "M5",
      generation: "G90",
    },
    {
      mode: "projection",
      query: "locale=en&scope=moto&make=BMW&model=S+1000+RR&chassis=K67",
      model: "S 1000 RR",
      generation: "K67",
    },
    {
      mode: "legacy",
      query: "locale=ua&make=BMW&model=M5&chassis=G90&engine=S68",
      model: "M5",
      generation: "G90",
    },
    {
      mode: "legacy",
      query: "locale=en&make=BMW&model=M5&chassis=G90&fuel=hybrid",
      model: "M5",
      generation: "G90",
    },
    {
      mode: "legacy",
      query: "locale=ua&make=BMW&model=M5&chassis=G90&opfGpf=without",
      model: "M5",
      generation: "G90",
    },
  ];
  try {
    for (const fixture of cases) {
      mock.reset();
      process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE = fixture.mode;
      const input = new URLSearchParams(fixture.query);
      const response = await queryPremiumCatalogProjection(input);
      assert.equal(response.status, 200);
      assert.equal(mock.state.legacyCalls, 0);
      assert.match(response.headers.get("Server-Timing") ?? "", /reader;desc=native/);
      for (const query of [
        ...mock.state.queries,
        ...mock.state.facetQueries,
        ...mock.state.countQueries,
      ]) {
        assert.equal(query.productIds, undefined);
        assert.equal(query.make, "BMW");
        assert.equal(query.model, fixture.model);
        assert.equal(query.generation, fixture.generation);
        assert.equal(query.engine, input.get("engine"));
        assert.equal(query.fuel, input.get("fuel"));
        assert.equal(query.opfGpf, input.get("opfGpf"));
        assert.equal(query.scope, input.get("scope"));
        assert.equal(query.locale, input.get("locale"));
      }
    }
  } finally {
    if (oldMode === undefined) delete process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE;
    else process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE = oldMode;
  }
});
