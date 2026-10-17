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
    /Cache-Control[\s\S]*public, max-age=60, s-maxage=\$\{SHOP_CATALOG_SELECTOR_CACHE_SECONDS\}, stale-while-revalidate=86400/
  );
});

test("fitment selector options are shared across requests and invalidated with the storefront", () => {
  const revalidation = readFileSync("src/lib/shopStorefrontRevalidation.ts", "utf8");
  const adminReset = readFileSync("src/app/api/admin/revalidate/route.ts", "utf8");
  assert.match(fitmentRoute, /unstable_cache\(/);
  // The reader-gated legacy fallback keeps the short shared lifetime.
  const legacy = fitmentRoute.slice(fitmentRoute.indexOf("await getShopProductsWithFitments()"));
  assert.doesNotMatch(legacy, /return cachedJson\(/);
  assert.match(fitmentRoute, /legacyFallbackJson[\s\S]*s-maxage=60, stale-while-revalidate=60/);
  assert.match(fitmentRoute, /tags: \[SHOP_CATALOG_SELECTOR_CACHE_TAG\]/);
  assert.match(revalidation, /revalidateTag\(SHOP_CATALOG_SELECTOR_CACHE_TAG/);
  assert.match(adminReset, /revalidateTag\(SHOP_CATALOG_SELECTOR_CACHE_TAG/);
});

test("catalog text search waits for Enter and keeps One AI behind its flag", () => {
  assert.match(stockPage, /const LIVE_SEARCH_SUGGESTIONS = false as boolean;/);
  // The One AI button renders only when NEXT_PUBLIC_ONE_AI_ENABLED=1 is built in.
  assert.match(
    stockPage,
    /const ONE_AI_ENABLED = process\.env\.NEXT_PUBLIC_ONE_AI_ENABLED === "1";/
  );
  assert.match(stockPage, /\{ONE_AI_ENABLED && !showLegacyOneAi \? \(\s*<OneAiAssistant/);
  // The previous assistant is a development-only comparison, never in production.
  assert.match(stockPage, /if \(process\.env\.NODE_ENV === "production"\) return;/);
  assert.match(stockPage, /\{showLegacyOneAi \? \(\s*<StockAiAssistant/);
  // Typing only edits the draft; the applied query changes on Enter / "Search".
  assert.match(stockPage, /value=\{queryDraft\}/);
  assert.match(stockPage, /onChange=\{\(event\) => setQueryDraft\(event\.target\.value\)\}/);
  assert.doesNotMatch(stockPage, /onChange=\{\(event\) => setQuery\(/);
  const keyHandler = stockPage.indexOf("const handleSearchKeyDown");
  const enterBranch = stockPage.indexOf('if (event.key === "Enter")', keyHandler);
  const submit = stockPage.indexOf("submitSearch();", enterBranch);
  assert.ok(keyHandler >= 0 && enterBranch > keyHandler && submit > enterBranch);
  assert.match(stockPage, /onClick=\{submitSearch\}/);
  // The phone filter panel has no submit button, so Enter is handled explicitly.
  const panel = stockPage.indexOf("const renderFilterPanel = (mobile = false) =>");
  const panelEnter = stockPage.indexOf("event.preventDefault();", panel);
  const panelClose = stockPage.indexOf("setMobileFiltersOpen(false);", panelEnter);
  assert.ok(panel >= 0 && panelEnter > panel && panelClose > panelEnter);
  assert.ok(panelClose - panel < 1200, "Enter must close the phone panel inside renderFilterPanel");
  // "Reset all" also clears text that was typed but never submitted.
  const reset = stockPage.indexOf("function handleResetFilters()");
  const resetEnd = stockPage.indexOf("\n  }\n", reset);
  assert.ok(reset >= 0 && stockPage.slice(reset, resetEnd).includes('setQueryDraft("")'));
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
