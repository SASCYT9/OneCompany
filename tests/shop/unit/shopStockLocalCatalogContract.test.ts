import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchRoute = readFileSync("src/lib/shopStockSearch.server.ts", "utf8");
const canonicalVehicleReader = readFileSync(
  "src/lib/shopStockCanonicalVehicleIds.server.ts",
  "utf8"
);
const fitmentRoute = readFileSync("src/app/api/shop/stock/fitment/route.ts", "utf8");
const canonicalFitmentReader = readFileSync(
  "src/lib/shopCanonicalFitmentOptions.server.ts",
  "utf8"
);
const stockPage = readFileSync("src/app/[locale]/shop/stock/StockCatalogClient.tsx", "utf8");

test("unified stock search loads generated storefront products before Prisma in local mode", () => {
  const catalogLoader = searchRoute.indexOf("export async function getShopProductsWithFitments()");
  const localBranch = searchRoute.indexOf("if (isLocalStorefrontMode()) {", catalogLoader);
  const snapshotLoad = searchRoute.indexOf("await getShopProductsServer()", localBranch);
  const prismaVersionCheck = searchRoute.indexOf(
    "prisma.shopProductMetafield.aggregate",
    localBranch
  );

  assert.ok(localBranch >= 0, "expected an explicit local storefront branch");
  assert.ok(snapshotLoad > localBranch, "expected the generated catalog fallback loader");
  assert.ok(
    prismaVersionCheck > snapshotLoad,
    "local snapshot loading must happen before any fitment metafield query"
  );
  assert.match(
    searchRoute,
    /async function hasStrictCatalogCoverage\(\) \{\s*if \(isLocalStorefrontMode\(\)\) return false;/
  );
  assert.match(
    searchRoute,
    /async function getShopProductsWithFitmentsByIds[\s\S]*?if \(isLocalStorefrontMode\(\)\)[\s\S]*?getShopProductsWithFitments\(\)/
  );
});

test("fitment selectors skip canonical Prisma coverage in local snapshot mode", () => {
  assert.match(
    canonicalFitmentReader,
    /async function getCanonicalFitmentOptions\([\s\S]*?if \(isLocalStorefrontMode\(\)\) return null;/
  );
  assert.match(fitmentRoute, /await getShopProductsWithFitments\(\)/);
  assert.match(fitmentRoute, /await getCanonicalFitmentOptions\(/);
  assert.match(
    searchRoute,
    /if\s*\(\s*!isLocalStorefrontMode\(\)\s*&&\s*process\.env\.SHOP_CATALOG_V2_READER_MODE/
  );
  assert.match(searchRoute, /return await queryPremiumCatalogProjection\(searchParams\)/);
  const localGuard = canonicalVehicleReader.indexOf("if (isLocalStorefrontMode()) return null;");
  const firstDatabaseRead = canonicalVehicleReader.indexOf("await prisma.");
  assert.ok(localGuard >= 0, "canonical vehicle lookup must skip the database in local mode");
  assert.ok(firstDatabaseRead > localGuard, "the local guard must precede canonical Prisma reads");
});

test("fitment responses are browser-cacheable for repeated mobile filter opens", () => {
  assert.match(
    fitmentRoute,
    /Cache-Control[\s\S]*public, max-age=30, s-maxage=60, stale-while-revalidate=60/
  );
});

test("initial search remains immediate across React Strict Mode effect replay", () => {
  const effect = stockPage.indexOf("// Auto-search for filters and queries");
  const timer = stockPage.indexOf("autoSearchTimerRef.current = setTimeout", effect);
  const initialReset = stockPage.indexOf("initialSearchRef.current = false", effect);

  assert.ok(effect >= 0 && timer > effect, "expected the catalog auto-search effect");
  assert.ok(
    initialReset > timer,
    "the initial marker must reset only after the replay-safe timer actually starts"
  );
});
