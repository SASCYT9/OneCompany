import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
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
    q: "x".repeat(257),
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

test("catalog page keeps the premium UI while its API reads the bounded projection", () => {
  const source = readFileSync("src/app/[locale]/shop/catalog/page.tsx", "utf8");
  const api = readFileSync("src/app/api/shop/stock/search/route.ts", "utf8");
  const adapter = readFileSync("src/lib/shopCatalogPremiumProjection.server.ts", "utf8");
  assert.match(source, /PremiumCatalogPage/);
  assert.match(source, /stock\/page/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.match(api, /queryPremiumCatalogProjection/);
  assert.match(adapter, /queryShopCatalogProjection\(query\)/);
  assert.match(adapter, /queryShopCatalogProjectionFacets\(query\)/);
  assert.match(adapter, /queryShopCatalogProjectionStockSummary\(query, warehouseProductIds\)/);
  assert.match(adapter, /totalItems = stockSummary\.totalItems/);
  assert.match(adapter, /getShopCatalogCardPricingByIds/);
  assert.match(adapter, /=== "moto" \? "moto" : null/);
  assert.match(adapter, /Promise\.all/);
  assert.match(source, /PremiumCatalogPage/);
  const premium = readFileSync("src/app/[locale]/shop/stock/page.tsx", "utf8");
  assert.match(premium, /setSelectedBrands\(\[\]\)/);
  assert.match(premium, /renderStandardCompatibilityFields/);
  assert.match(premium, /name="fuel"|params\.set\("fuel"/);
});

test("flag-off catalog is internally rewritten without coupling legacy client code to V2", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /\["ssr", "canary"\]/);
  assert.match(config, /source: "\/:locale\(ua\|en\)\/shop\/catalog"/);
  assert.match(config, /destination: "\/:locale\/shop\/stock"/);
});

test("canary routing is request-bound and the page still fails closed without its header", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const page = readFileSync("src/app/[locale]/shop/catalog/page.tsx", "utf8");
  const suggest = readFileSync("src/app/api/shop/catalog/suggest/route.ts", "utf8");
  assert.match(proxy, /evaluateShopCatalogCanary/);
  assert.match(proxy, /NextResponse\.rewrite\(legacyUrl\)/);
  assert.match(proxy, /SHOP_CATALOG_CANARY_REQUEST_HEADER/);
  assert.match(proxy, /Vary", "Cookie/);
  assert.match(page, /PremiumCatalogPage/);
  assert.match(suggest, /isShopCatalogReaderRequestEnabled/);
});

test("premium catalog adapter keeps projection failures recoverable in the stock API", () => {
  const page = readFileSync("src/app/[locale]/shop/catalog/page.tsx", "utf8");
  const api = readFileSync("src/app/api/shop/stock/search/route.ts", "utf8");
  assert.match(page, /PremiumCatalogPage/);
  assert.match(api, /catch \(error: any\)/);
  assert.match(api, /NextResponse\.json\(\{ error: error\.message \}, \{ status: 500 \}\)/);
});

test("vehicle filtering reads canonical projection clauses without depending on AI coverage", () => {
  const api = readFileSync("src/app/api/shop/stock/search/route.ts", "utf8");
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
  const page = readFileSync("src/app/[locale]/shop/stock/page.tsx", "utf8");
  const canonical = readFileSync("src/lib/shopCanonicalFitmentOptions.server.ts", "utf8");
  assert.match(api, /await getCanonicalFitmentOptions\(/);

  assert.match(canonical, /shopCatalogProjectionConstraint\.groupBy/);
  for (const dimension of ["MAKE", "MODEL", "CHASSIS", "GENERATION", "ENGINE"]) {
    assert.match(canonical, new RegExp(`exactValues\\("${dimension}"`));
  }
  assert.doesNotMatch(canonical, /shopProductKnowledge|shopVehicleApplication/);
  assert.doesNotMatch(api, /hasCanonicalCatalogCoverage/);
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
  assert.match(server, /afterRank/);
  assert.match(server, /afterProduct/);
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
  const error = readFileSync("src/app/[locale]/shop/catalog/error.tsx", "utf8");
  const server = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Server.tsx", "utf8");
  const premium = readFileSync("src/app/[locale]/shop/stock/page.tsx", "utf8");
  assert.match(loading, /return null/);
  assert.doesNotMatch(loading, /animate-pulse|aspect-square/);
  assert.doesNotMatch(premium, /Array\.from\(\{ length: 12 \}\)/);
  assert.match(error, /"use client"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.match(error, /filters remain in the URL/);
  assert.match(server, /result\.items\.length === 0/);
});
