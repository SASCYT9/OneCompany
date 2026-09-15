import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stockPage = readFileSync("src/app/[locale]/shop/stock/page.tsx", "utf8");
const stockClient = readFileSync("src/app/[locale]/shop/stock/StockCatalogClient.tsx", "utf8");
const stockLoading = readFileSync("src/app/[locale]/shop/stock/loading.tsx", "utf8");
const catalogLoading = readFileSync("src/app/[locale]/shop/catalog/loading.tsx", "utf8");
const loadingShell = readFileSync("src/app/[locale]/shop/stock/CatalogLoadingShell.tsx", "utf8");
const stockSearch = readFileSync("src/lib/shopStockSearch.server.ts", "utf8");
const fitmentCatalog = readFileSync("src/lib/shopFitmentCatalogServer.ts", "utf8");
const storefrontRevalidation = readFileSync("src/lib/shopStorefrontRevalidation.ts", "utf8");
const genericProductPage = readFileSync(
  "src/app/(strict-http)/[locale]/shop/[slug]/page.tsx",
  "utf8"
);

test("catalog streams a useful theme-aware loading shell during its initial search", () => {
  assert.match(stockPage, /<Suspense fallback=\{<CatalogLoadingShell \/>\}>/);
  assert.match(stockLoading, /<CatalogLoadingShell \/>/);
  assert.match(catalogLoading, /<CatalogLoadingShell \/>/);
  assert.match(loadingShell, /aria-busy="true"/);
  assert.match(loadingShell, /bg-background text-foreground/);
  assert.match(loadingShell, /ProductCardSkeleton/);
  assert.doesNotMatch(stockLoading, /BrandedLoadingScreen/);
  assert.doesNotMatch(catalogLoading, /return null/);
});

test("catalog serves its loading UI immediately and lets the cacheable API provide products", () => {
  assert.match(stockPage, /<StockCatalogClient \/>/);
  assert.doesNotMatch(stockPage, /searchShopStock/);
  assert.match(stockClient, /if \(isInitialCatalogLoading\) return <CatalogLoadingShell \/>;/);
  assert.match(stockSearch, /public, s-maxage=60, stale-while-revalidate=300/);
  assert.match(stockSearch, /const pricingContextPromise = buildShopViewerPricingContextServer/);
  assert.match(
    stockSearch,
    /const pricingContextPromise = buildShopViewerPricingContextServer\([\s\S]*const allProductsWithFitments/
  );
  assert.match(stockSearch, /const pricingContext = await pricingContextPromise/);
  assert.match(
    stockSearch,
    /SHOP_CATALOG_V2_READER_MODE[\s\S]{0,300}if \(canUsePremiumCatalogProjection/
  );
  assert.match(
    stockClient,
    /const heroInventoryItems = warehouseHeroItems\.length \? warehouseHeroItems : items;/
  );
  assert.match(stockClient, /carousel: "1",[\s\S]{0,100}limit: "96"/);
});

test("the initial browse keeps every product while avoiding rich joins and sharing the invalidated cache", () => {
  assert.match(stockSearch, /includeVariants: false,[\s\S]*includeCollections: false/);
  assert.match(stockSearch, /getShopProductsWithFitmentsByIds\([\s\S]*paginatedItems\.map/);
  assert.match(fitmentCatalog, /pageSize:[\s\S]*!includeVariants[\s\S]*1_000/);
  assert.match(fitmentCatalog, /cacheStrategy: \{ ttl: 300, swr: 60, tags: \["shop-products"\] \}/);
  assert.match(storefrontRevalidation, /invalidateShopStockSearchCaches\(\)/);
});

test("generic product pages keep readable foreground contrast in both themes", () => {
  assert.match(
    genericProductPage,
    /min-h-screen bg-background text-foreground dark:bg-linear-to-b dark:from-black/
  );
  assert.match(genericProductPage, /border border-foreground\/18 bg-card/);
  assert.doesNotMatch(
    genericProductPage,
    /min-h-screen bg-linear-to-b from-black via-zinc-950 to-black text-foreground/
  );
});
