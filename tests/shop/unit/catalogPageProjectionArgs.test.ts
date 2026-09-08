import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerTestModuleHooks } from "./testHooks.mjs";

const fixture = pathToFileURL(path.resolve("tests/shop/unit/fixtures/catalog-page-mocks.mjs")).href;
const aliases = [
  "@/lib/shopCatalogProjectionQuery.server",
  "@/lib/shopCatalogCardPricing.server",
  "@/lib/shopCustomerSession",
  "@/lib/shopAdminSettings",
  "@/lib/prisma",
  "@/lib/shopPricingContext.server",
  "@/lib/shopWarehouseInventory",
  "@/lib/shopWarehouseInventory.server",
  "@/lib/shopCatalogVehicleSearchPlan",
  "@/lib/shopCatalogLegacyVehicleIds.server",
  "@/lib/eventuriSharedIntake",
  "@/lib/seo",
  "@/lib/shopCatalogReaderFlag.server",
  "@/lib/shopCatalogCanary",
  "@/lib/shopCatalogReadTelemetry",
  "@/lib/shopCatalogPremiumEligibility",
  "@/lib/shopStorefrontRouting",
  "@/lib/shopKwCardPresentation",
  "@/lib/shopProductDisplayBrand",
  "next/server",
  "next/navigation",
  "next/headers",
];
registerTestModuleHooks({ mockedAliases: aliases, mockUrl: fixture });

const modulePromise = import("../../../src/app/[locale]/shop/catalog/page");

async function readPage(searchParams: Record<string, string>) {
  const page = await modulePromise;
  const mock = await import("./fixtures/catalog-page-mocks.mjs");
  mock.reset();
  await page.default({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve(searchParams),
  });
  return mock.calls;
}

test("CatalogPage passes effective pricing and stock constraints to listing and facets", async () => {
  const all = await readPage({ country: "DE", currency: "EUR" });
  assert.equal(all.warehouseQueries, 0);
  assert.equal(all.queries.length, 1);
  assert.equal(all.facetQueries.length, 1);
  assert.equal(all.queries[0].effectivePriceContext.currency, "EUR");
  assert.equal(all.facetQueries[0].effectivePriceContext.audience, "b2b");
  assert.equal(all.queries[0].productIds, null);

  const inStock = await readPage({ stock: "inStock" });
  assert.equal(inStock.warehouseQueries, 1);
  assert.deepEqual(inStock.queries[0].productIds, ["warehouse-a", "warehouse-b"]);
  assert.deepEqual(inStock.facetQueries[0].productIds, ["warehouse-a", "warehouse-b"]);

  const preOrder = await readPage({ stock: "preOrder" });
  assert.equal(preOrder.warehouseQueries, 1);
  assert.deepEqual(preOrder.queries[0].excludeProductIds, ["warehouse-a", "warehouse-b"]);
  assert.deepEqual(preOrder.facetQueries[0].excludeProductIds, ["warehouse-a", "warehouse-b"]);
});

test("CatalogPage uses legacy vehicle IDs while keeping native powertrain constraints correlated", async () => {
  const legacy = await readPage({ make: "BMW", model: "M5", chassis: "G90", year: "2025" });
  assert.equal(legacy.legacyCalls, 1);
  assert.deepEqual(legacy.queries[0].productIds, ["legacy-id", "legacy-stock-id"]);
  assert.equal(legacy.queries[0].make, null);
  assert.equal(legacy.queries[0].model, null);
  assert.equal(legacy.queries[0].generation, null);
  assert.equal(legacy.queries[0].year, null);

  const native = await readPage({
    make: "BMW",
    model: "M5",
    chassis: "G90",
    engine: "S68",
    fuel: "hybrid",
    opfGpf: "without",
    stock: "inStock",
  });
  assert.equal(native.legacyCalls, 0);
  assert.equal(native.queries[0].productIds?.join(","), "warehouse-a,warehouse-b");
  assert.equal(native.queries[0].make, "BMW");
  assert.equal(native.queries[0].model, "M5");
  assert.equal(native.queries[0].generation, "G90");
  assert.equal(native.queries[0].engine, "S68");
  assert.equal(native.queries[0].fuel, "hybrid");
  assert.equal(native.queries[0].opfGpf, "without");
});

test("CatalogPage performs a narrow shared Eventuri lookup for stock=all and deduplicates its legacy row", async () => {
  const calls = await readPage({ make: "Audi", model: "Q8" });
  assert.equal(calls.warehouseQueries, 0);
  assert.equal(calls.sharedLookupQueries, 1);
  assert.deepEqual(calls.queries[0].excludeProductIds, ["shared-duplicate"]);
  assert.deepEqual(calls.queries[0].productIds, [
    "legacy-id",
    "legacy-stock-id",
    "shared-canonical",
  ]);
});

test("CatalogPage treats auto scope as the unpartitioned default", async () => {
  const calls = await readPage({ make: "BMW", model: "M5", scope: "auto" });
  assert.equal(calls.queries[0].scope, null);
});
