import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compareShopBrandLabels } from "../../../src/lib/shopProductDisplayBrand";
import { shopVehicleModelsMatch } from "../../../src/lib/shopVehicleConstraints";
import {
  canonicalVehicleModelLabel,
  vehicleModelAliases,
} from "../../../src/lib/shopVehicleTaxonomy";

const fitmentRoute = readFileSync("src/app/api/shop/stock/fitment/route.ts", "utf8");
const revalidation = readFileSync("src/lib/shopStorefrontRevalidation.ts", "utf8");
const premiumProjection = readFileSync("src/lib/shopCatalogPremiumProjection.server.ts", "utf8");
const legacySearch = readFileSync("src/lib/shopStockSearch.server.ts", "utf8");
const stockPage = readFileSync("src/app/[locale]/shop/stock/StockCatalogClient.tsx", "utf8");

test("brand pickers list brands A-Z regardless of case, accents or product count", () => {
  const brands = [
    "RaceChip",
    "Remus",
    "KW Suspensions",
    "Brabus",
    "GiroDisc",
    "BMC",
    "Burger Motorsports",
    "OHLINS",
    "DO88",
    "AKRAPOVIC",
    "Eventuri",
    "ADRO",
    "iPE exhaust",
  ];
  assert.deepEqual([...brands].sort(compareShopBrandLabels), [
    "ADRO",
    "AKRAPOVIC",
    "BMC",
    "Brabus",
    "Burger Motorsports",
    "DO88",
    "Eventuri",
    "GiroDisc",
    "iPE exhaust",
    "KW Suspensions",
    "OHLINS",
    "RaceChip",
    "Remus",
  ]);
  assert.ok(compareShopBrandLabels("Akrapovič", "AKRAPOVIC") !== 0, "distinct labels stay ordered");
  assert.ok(compareShopBrandLabels("Akrapovič", "BMC") < 0);
});

test("brand facets are served and shown in alphabetical order", () => {
  assert.match(
    premiumProjection,
    /\.sort\(\(left, right\) => compareShopBrandLabels\(left\.label, right\.label\)\)/
  );
  assert.match(legacySearch, /compareShopBrandLabels\(left\.label, right\.label\)/);
  const visibleBrands = stockPage.slice(stockPage.indexOf("const visibleBrands = useMemo"));
  assert.match(visibleBrands.slice(0, 1200), /return compareShopBrandLabels\(left, right\);/);
  assert.doesNotMatch(visibleBrands.slice(0, 1200), /brandCountByLabel\.get\(right\)/);
});

test("model matching stays cheap enough for every fitment row of a picker request", () => {
  // Before the alias index each call re-normalized every alias of the make
  // (~1 ms), so a 2,600-product chassis list spent ~11 s in this loop.
  const started = performance.now();
  for (let index = 0; index < 5_000; index += 1) {
    shopVehicleModelsMatch(index % 2 ? "3 Series" : "M3 Touring", "M3", "BMW");
  }
  assert.ok(performance.now() - started < 1_500, "5,000 model matches must take well under 1.5 s");
  assert.ok(shopVehicleModelsMatch("m3", "M3", "BMW"));
  assert.ok(shopVehicleModelsMatch("M135i/M140i", "1 Series", "BMW"));
  assert.ok(!shopVehicleModelsMatch("M4", "M3", "BMW"));
});

test("alias lookups return fresh arrays from the shared index", () => {
  const first = vehicleModelAliases("BMW", "1 Series");
  first.push("mutated");
  assert.ok(!vehicleModelAliases("BMW", "1 Series").includes("mutated"));
  assert.equal(canonicalVehicleModelLabel("BMW", "M135i/M140i"), "1 Series");
  assert.equal(canonicalVehicleModelLabel("Mercedes-Benz", "G63"), "AMG G 63");
});

test("chassis options start the listing match together with the canonical read", () => {
  const cached = fitmentRoute.slice(fitmentRoute.indexOf("const readCachedSelectorOptions"));
  const legacyStart = cached.indexOf("listLegacyVehicleChassisOptions({ make, model })");
  const poolStart = cached.indexOf("prefetchLegacyVehicleMakePool(make)");
  const bmcWarmup = cached.indexOf("getBmcSupplierApplications().catch(");
  const canonicalRead = cached.indexOf("await getCanonicalFitmentOptions(input)");
  assert.ok(legacyStart > 0 && legacyStart < canonicalRead, "legacy chassis must start first");
  assert.ok(poolStart > 0 && poolStart < canonicalRead, "the make pool must start first");
  assert.ok(bmcWarmup > 0 && bmcWarmup < canonicalRead, "BMC contracts must start first");
  assert.match(cached, /readerMode,\s*legacyChassisOptions\s*\)/);
});

test("vehicle candidates come from one cached make pool, with the SQL form as fallback", () => {
  const legacy = readFileSync("src/lib/shopCatalogLegacyVehicleIds.server.ts", "utf8");
  const finder = legacy.slice(legacy.indexOf("async function findLegacyFitmentCandidateIds"));
  const body = finder.slice(0, finder.indexOf("\ntype StringMatchFilter"));
  const pool = body.indexOf("getMakeCandidatePool(canonicalMake, makeValues, makeTags)");
  const fallback = body.indexOf("OR: alternatives");
  assert.ok(pool > 0 && fallback > pool, "pool first, the single SQL query as fallback");
  // LIKE wildcards in a value keep the SQL semantics.
  assert.match(body, /textValues\.some\(\(value\) => \/\[%_\\\\\]\/\.test\(value\)\)/);
  // Tag-only alternatives (model:/chassis: tags without a make) stay a SQL read.
  assert.match(body, /tags: \{ hasSome: \[\.\.\.tagValues\] \}/);
  assert.match(legacy, /const MAKE_POOL_CACHE_MS = 60_000;/);
});

test("price and stock edits keep selector options; fitment edits refresh them in the background", () => {
  const detailOnlyReturn = revalidation.indexOf("if (detailOnly) return Promise.resolve();");
  const selectorTag = revalidation.indexOf('revalidateTag(SHOP_CATALOG_SELECTOR_CACHE_TAG, "max")');
  assert.ok(detailOnlyReturn > 0 && selectorTag > detailOnlyReturn);
  assert.doesNotMatch(revalidation, /SHOP_CATALOG_SELECTOR_CACHE_TAG, \{ expire: 0 \}/);
});

test("choosing a make keeps the vehicle finder in view when the hero above it hides", () => {
  const effect = stockPage.slice(stockPage.indexOf("const previousShowWarehouseHeroRef"));
  const body = effect.slice(0, effect.indexOf("}, [showWarehouseHero]);"));
  assert.match(body, /document\.querySelector<HTMLElement>\("\[data-vehicle-finder\]"\)/);
  assert.match(body, /vehicleFinder\?\.contains\(document\.activeElement\)/);
  assert.match(body, /window\.scrollBy\(/);
});
