import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "./testHooks.mjs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const flagModule = import("../../../src/lib/shopCatalogReaderFlag.server");
const queryModule = import("../../../src/lib/shopCatalogStorefrontQuery");

test("Catalog V2 storefront reader is fail-closed and requires explicit SSR mode", async () => {
  const { resolveShopCatalogReaderFlag } = await flagModule;
  assert.deepEqual(resolveShopCatalogReaderFlag(undefined), {
    enabled: false,
    mode: "off",
    reason: "default_off",
  });
  assert.deepEqual(resolveShopCatalogReaderFlag("serve"), {
    enabled: false,
    mode: "off",
    reason: "invalid_value",
  });
  assert.deepEqual(resolveShopCatalogReaderFlag(" SSR "), {
    enabled: true,
    mode: "ssr",
    reason: "explicit_ssr",
  });
  assert.deepEqual(resolveShopCatalogReaderFlag("canary"), {
    enabled: false,
    mode: "canary",
    reason: "explicit_canary",
  });
});

test("storefront query maps bounded progressive filters and a complete keyset cursor", async () => {
  const { parseShopCatalogStorefrontQuery } = await queryModule;
  const parsed = parseShopCatalogStorefrontQuery("ua", {
    q: "  intake  ",
    brand: ["Eventuri", "ignored"],
    make: "BMW",
    model: "M2",
    generation: "G87",
    year: "2024",
    engine: "S58",
    fuel: "petrol",
    afterRank: "12.50",
    afterProduct: "product-42",
  });
  assert.deepEqual(parsed, {
    locale: "ua",
    limit: 24,
    offset: 0,
    page: 1,
    after: { stableRank: "12.50", productId: "product-42" },
    text: "intake",
    scope: null,
    brands: ["Eventuri", "ignored"],
    brand: "Eventuri",
    category: null,
    make: "BMW",
    model: "M2",
    generation: "G87",
    year: 2024,
    engine: "S58",
    fuel: "petrol",
    opfGpf: null,
    productIds: null,
    excludeProductIds: null,
    minPrice: null,
    maxPrice: null,
    priceCurrency: "USD",
    order: "default",
    orderSeed: null,
    useEuropePrice: false,
    stock: "all",
    productType: null,
    productKind: null,
    strict: false,
    facetMode: "filtered",
    country: null,
  });
});

test("storefront query ignores malformed optional filters instead of broadening compatibility", async () => {
  const { parseShopCatalogStorefrontQuery } = await queryModule;
  const parsed = parseShopCatalogStorefrontQuery("en", {
    q: "x".repeat(1025),
    year: "twenty",
    afterRank: "not-a-rank",
    afterProduct: "product-42",
  });
  assert.equal(parsed.text, null);
  assert.equal(parsed.year, null);
  assert.equal(parsed.after, null);
});

test("storefront DTO carries bounded price, stock, scope, facets and product filters", async () => {
  const { parseShopCatalogStorefrontQuery } = await queryModule;
  const params = new URLSearchParams([
    ["page", "3"],
    ["limit", "40"],
    ["brand", "BMW"],
    ["brand", " BMW "],
    ["brand", "Audi"],
    ["category", "downpipe"],
    ["productType", "Exhaust"],
    ["productKind", "downpipe"],
    ["scope", "MOTO"],
    ["stock", "inStock"],
    ["sort", "price_desc"],
    ["currency", "EUR"],
    ["europePrice", "true"],
    ["minPrice", "900"],
    ["maxPrice", "100"],
    ["strict", "1"],
    ["facetMode", "global"],
    ["country", "DE"],
    ["chassis", "G90"],
    ["opfGpf", " WITH "],
  ]);
  const parsed = parseShopCatalogStorefrontQuery("en", params);
  assert.equal(parsed.page, 3);
  assert.equal(parsed.limit, 40);
  assert.equal(parsed.offset, 80);
  assert.deepEqual(parsed.brands, ["BMW", "Audi"]);
  assert.equal(parsed.brand, "BMW");
  assert.equal(parsed.scope, "moto");
  assert.equal(parsed.stock, "inStock");
  assert.equal(parsed.order, "price_desc");
  assert.equal(parsed.priceCurrency, "EUR");
  assert.equal(parsed.useEuropePrice, true);
  assert.equal(parsed.minPrice, 100);
  assert.equal(parsed.maxPrice, 900);
  assert.equal(parsed.productType, "Exhaust");
  assert.equal(parsed.productKind, "downpipe");
  assert.equal(parsed.strict, true);
  assert.equal(parsed.facetMode, "global");
  assert.equal(parsed.country, "DE");
  assert.equal(parsed.generation, "G90");
  assert.equal(parsed.opfGpf, "with");
});

test("catalog page serves projection SSR only behind the reader guard", () => {
  const source = readFileSync("src/app/[locale]/shop/catalog/page.tsx", "utf8");
  const api = readFileSync("src/lib/shopStockSearch.server.ts", "utf8");
  const adapter = readFileSync("src/lib/shopCatalogPremiumProjection.server.ts", "utf8");
  assert.match(source, /resolveShopCatalogReaderFlag/);
  assert.match(source, /isShopCatalogReaderRequestEnabled/);
  assert.match(source, /CatalogV2Server/);
  assert.doesNotMatch(source, /PremiumCatalogPage/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.match(api, /queryPremiumCatalogProjection/);
  assert.match(adapter, /queryShopCatalogProjection\(query\)/);
  assert.match(adapter, /queryShopCatalogProjectionFacets\(query\)/);
  assert.match(adapter, /queryShopCatalogProjectionStockSummary\(query, warehouseProductIds\)/);
  assert.match(adapter, /totalItems = stockSummary\.totalItems/);
  assert.match(adapter, /getShopCatalogCardPricingByIds/);
  assert.match(adapter, /=== "moto" \? "moto" : null/);
  assert.match(adapter, /Promise\.all/);
  assert.match(source, /CatalogV2Server/);
  assert.match(source, /redirect\(legacyCatalogHref/);
  assert.match(source, /canUsePremiumCatalogProjection/);
  assert.match(source, /eligibilityParams/);
  assert.match(source, /product type\/kind, strict, global facets/);
  const premium = readFileSync("src/app/[locale]/shop/stock/StockCatalogClient.tsx", "utf8");
  assert.match(premium, /setSelectedBrands\(\[\]\)/);
  assert.match(premium, /renderStandardCompatibilityFields/);
  assert.match(premium, /name="fuel"|params\.set\("fuel"/);
});

test("approved catalog design is preserved unless the separate SSR UI is explicitly enabled", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /\["ssr", "canary"\]/);
  assert.match(config, /process\.env\.SHOP_CATALOG_V2_SSR_UI !== "1" \|\|/);
  assert.match(config, /source: "\/:locale\(ua\|en\)\/shop\/catalog"/);
  assert.match(config, /destination: "\/:locale\/shop\/stock"/);
});

test("all faceted storefront listings receive noindex headers, including the rewritten catalog", async () => {
  const config = (await import("../../../next.config")).default as {
    headers?: () => Promise<
      Array<{
        source?: string;
        has?: Array<{ key?: string }>;
        headers?: Array<{ key?: string; value?: string }>;
      }>
    >;
  };
  const headers = (await config.headers?.()) ?? [];
  const facetedSources = headers.filter((entry) =>
    entry.headers?.some(
      (header) => header.key === "X-Robots-Tag" && header.value === "noindex, follow"
    )
  );
  assert.ok(
    facetedSources.some((entry) => entry.source?.includes("akrapovic|")),
    "brand listing source must cover every storefront with filters"
  );
  for (const key of ["scope", "segment", "manufacturer", "model", "brand", "keyword"]) {
    assert.ok(
      facetedSources.some(
        (entry) =>
          entry.has?.some((condition) => condition.key === key) && entry.source?.includes("shop")
      ),
      `missing noindex rule for query key ${key}`
    );
  }
  assert.ok(
    facetedSources.some(
      (entry) =>
        entry.source === "/:locale(ua|en)/shop/catalog" &&
        entry.has?.some((condition) => condition.key === "brand")
    ),
    "rewritten general catalog must have a source-level noindex rule"
  );
  for (const key of ["scope", "segment"]) {
    assert.ok(
      facetedSources.some(
        (entry) =>
          entry.source === "/:locale(ua|en)/shop/akrapovic" &&
          entry.has?.some((condition) => condition.key === key)
      ),
      `missing noindex rule for Akrapovič home mode ${key}`
    );
  }
});

test("server-rendered Akrapovic and Ilmberger listings expose crawlable product list schemas", () => {
  const akrapovic = readFileSync("src/app/[locale]/shop/akrapovic/collections/page.tsx", "utf8");
  const ilmberger = readFileSync("src/app/[locale]/shop/ilmberger/collections/page.tsx", "utf8");
  for (const source of [akrapovic, ilmberger]) {
    assert.match(source, /BreadcrumbSchema/);
    assert.match(source, /generateProductItemListSchema/);
    assert.match(source, /buildShopStorefrontProductPathForProduct/);
    assert.match(source, /<JsonLd schema=\{itemListSchema\} \/>/);
  }
});

test("brand listing pages expose one localized h1 without changing the visual layer", () => {
  for (const file of [
    "src/app/[locale]/shop/akrapovic/collections/page.tsx",
    "src/app/[locale]/shop/do88/collections/page.tsx",
    "src/app/[locale]/shop/brabus/collections/page.tsx",
    "src/app/[locale]/shop/urban/collections/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.equal((source.match(/<h1\b/g) ?? []).length, 1, `${file} must expose one h1`);
    assert.match(source, /<h1 className="sr-only">/);
  }
});

test("Brabus collection routes expose breadcrumb and canonical product list schemas", () => {
  const source = readFileSync("src/app/[locale]/shop/brabus/collections/[handle]/page.tsx", "utf8");
  assert.match(source, /BreadcrumbSchema/);
  assert.match(source, /generateProductItemListSchema/);
  assert.match(source, /buildShopStorefrontProductPathForProduct/);
  assert.match(source, /!config \? <h1 className="sr-only">/);
});

test("GiroDisc and Öhlins home pages use the shared canonical locale metadata", () => {
  for (const file of [
    "src/app/[locale]/shop/girodisc/page.tsx",
    "src/app/[locale]/shop/ohlins/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /buildPageMetadata/);
    assert.match(source, /buildPageMetadata\(resolvedLocale, "shop\/(?:girodisc|ohlins)"/);
  }
});

test("all premium brand home pages expose a server-rendered brand schema", () => {
  for (const file of [
    "src/app/[locale]/shop/adro/page.tsx",
    "src/app/[locale]/shop/burger/page.tsx",
    "src/app/[locale]/shop/csf/page.tsx",
    "src/app/[locale]/shop/girodisc/page.tsx",
    "src/app/[locale]/shop/ipe/page.tsx",
    "src/app/[locale]/shop/ohlins/page.tsx",
    "src/app/[locale]/shop/racechip/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /generateBrandSchema/);
    assert.match(source, /<JsonLd/);
  }
});

test("migrated storefront links stay on canonical localized catalog routes", () => {
  const userFacingFiles = [
    "src/components/shared/Navigation.tsx",
    "src/components/ui/Navigation.tsx",
    "src/components/ui/LocalizedNavigation.tsx",
    "src/components/ui/StoreHeroSection.tsx",
    "src/components/ui/BrandsGrid.tsx",
    "src/app/[locale]/shop/components/OurStoresPortal.tsx",
    "src/app/[locale]/shop/data/ourStores.ts",
    "public/index.html",
  ];

  for (const file of userFacingFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /https:\/\/(?:www\.)?(?:kwsuspension|fiexhaust|eventuri)\.shop/,
      `${file} must not link to a closed storefront`
    );
  }

  const navigation = readFileSync("src/components/ui/LocalizedNavigation.tsx", "utf8");
  for (const section of ["categories", "about", "contact"]) {
    assert.match(navigation, new RegExp(`href=\\{\\\`/\\$\\{locale\\}/${section}\\\``));
  }

  const brands = readFileSync("src/lib/brands.ts", "utf8");
  assert.match(brands, /https:\/\/www\.kwsuspensions\.com/);
  assert.match(brands, /https:\/\/www\.fi-exhaust\.com/);
});

test("canary routing is request-bound and the page still fails closed without its header", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const page = readFileSync("src/app/[locale]/shop/catalog/page.tsx", "utf8");
  const suggest = readFileSync("src/app/api/shop/catalog/suggest/route.ts", "utf8");
  assert.match(proxy, /evaluateShopCatalogCanary/);
  assert.match(proxy, /catalogMatch && process\.env\.SHOP_CATALOG_V2_SSR_UI !== "1"/);
  assert.match(proxy, /NextResponse\.rewrite\(legacyUrl\)/);
  assert.match(proxy, /SHOP_CATALOG_CANARY_REQUEST_HEADER/);
  assert.match(proxy, /Vary", "Cookie/);
  assert.match(page, /CatalogV2Server/);
  assert.match(page, /isShopCatalogReaderRequestEnabled/);
  assert.match(suggest, /isShopCatalogReaderRequestEnabled/);
});

test("projection catalog keeps recoverable API failures isolated from SSR", () => {
  const page = readFileSync("src/app/[locale]/shop/catalog/page.tsx", "utf8");
  const api = readFileSync("src/lib/shopStockSearch.server.ts", "utf8");
  assert.match(page, /CatalogV2Server/);
  assert.match(api, /catch \(error: any\)/);
  assert.match(api, /NextResponse\.json\(\{ error: error\.message \}, \{ status: 500 \}\)/);
});

test("vehicle filtering reads canonical projection clauses without depending on AI coverage", () => {
  const api = readFileSync("src/lib/shopStockSearch.server.ts", "utf8");
  const resolver = readFileSync("src/lib/shopStockCanonicalVehicleIds.server.ts", "utf8");
  assert.match(api, /resolveCanonicalVehicleProductIds/);

  assert.match(resolver, /shopCatalogProjectionClause\.findMany/);
  assert.match(resolver, /canonicalClauseConstraints/);
  assert.doesNotMatch(resolver, /hasStrictCatalogCoverage/);
  assert.match(
    api,
    /canonicalVehicleProductIds === null[\s\S]*?shopFitmentMatchesVehicleConstraints/
  );
});

test("fitment selectors read the same projection clauses as vehicle search", () => {
  const api = readFileSync("src/app/api/shop/stock/fitment/route.ts", "utf8");
  const page = readFileSync("src/app/[locale]/shop/stock/StockCatalogClient.tsx", "utf8");
  const canonical = readFileSync("src/lib/shopCanonicalFitmentOptions.server.ts", "utf8");
  assert.match(api, /await getCanonicalFitmentOptions\(/);

  assert.match(canonical, /shopCatalogProjectionConstraint\.groupBy/);
  for (const dimension of ["MAKE", "MODEL", "CHASSIS", "GENERATION", "ENGINE"]) {
    assert.match(canonical, new RegExp(`exactValues\\("${dimension}"`));
  }
  assert.doesNotMatch(canonical, /shopProductKnowledge|shopVehicleApplication/);
  assert.doesNotMatch(api, /hasCanonicalCatalogCoverage/);
  assert.match(api, /SELECTOR_NOT_READY/);
  assert.match(api, /isShopCatalogReaderRequestEnabled\([\s\S]*?\)\s*\)\s*\{[\s\S]*?status: 503/);
  assert.match(
    api,
    /if \(canonical\) return cachedJson\(canonical\);[\s\S]*?SELECTOR_NOT_READY[\s\S]*?getShopProductsWithFitments\(\)/
  );
  assert.match(canonical, /dimension: "YEAR"/);
  assert.match(canonical, /detailClauseWhere/);
  assert.match(api, /searchParams\.get\("details"\) === "1"/);
  assert.match(page, /fitmentBrandParam/);
  assert.match(page, /details: "1"/);
  const detailsEffect = page.slice(
    page.indexOf("// Model/chassis"),
    page.indexOf("// Search handler")
  );
  assert.match(detailsEffect, /params\.set\("year", String\(requestedYear\)\)/);
  assert.match(detailsEffect, /chassis, make, model, requestedYear, vehicleMode/);
  assert.match(page, /fitmentYears\.map/);
  assert.match(page, /fitmentEngines\.map/);
});

test("SSR catalog exposes progressive GET filters and keyset continuation without client fetch", () => {
  const server = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Server.tsx", "utf8");
  const client = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Filters.tsx", "utf8");
  assert.match(server, /<CatalogV2Filters/);
  assert.match(client, /method="get"/);
  for (const field of [
    "q",
    "brand",
    "category",
    "make",
    "model",
    "generation",
    "year",
    "engine",
    "fuel",
  ]) {
    assert.match(client, new RegExp(`name=[{\"]+${field}`));
  }
  const pagination = readFileSync("src/lib/shopCatalogPagination.ts", "utf8");
  assert.match(server, /nextPageHref/);
  assert.match(pagination, /afterRank/);
  assert.match(pagination, /afterProduct/);
  assert.match(server, /rel="next"/);
  assert.doesNotMatch(server, /useEffect|fetch\(/);
  assert.match(client, /useTransition/);
  assert.match(client, /AbortController/);
  assert.match(client, /180/);
  assert.match(client, /applyShopCatalogFilterChange/);
  assert.match(client, /\/api\/shop\/catalog\/suggest/);
});

test("catalog route avoids transition graphics and keeps recoverable error states", () => {
  const loading = readFileSync("src/app/[locale]/shop/catalog/loading.tsx", "utf8");
  const loadingShell = readFileSync("src/app/[locale]/shop/stock/CatalogLoadingShell.tsx", "utf8");
  const error = readFileSync("src/app/[locale]/shop/catalog/error.tsx", "utf8");
  const server = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Server.tsx", "utf8");
  const premium = readFileSync("src/app/[locale]/shop/stock/StockCatalogClient.tsx", "utf8");
  assert.match(loading, /CatalogLoadingShell/);
  assert.match(loading, /return <CatalogLoadingShell \/>/);
  assert.match(loadingShell, /animate-pulse|aspect-square/);
  assert.doesNotMatch(premium, /Array\.from\(\{ length: 12 \}\)/);
  assert.match(error, /"use client"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.match(error, /filters remain in the URL/);
  assert.match(server, /result\.items\.length === 0/);
});
