export const calls =
  globalThis.__catalogPageMockCalls ??
  (globalThis.__catalogPageMockCalls = {
    queries: [],
    facetQueries: [],
    warehouseQueries: 0,
    legacyCalls: 0,
    sharedLookupQueries: 0,
  });

export async function connection() {}
export async function headers() {
  return new Map();
}
export function redirect() {
  throw new Error("unexpected redirect");
}

export function reset() {
  calls.queries.length = 0;
  calls.facetQueries.length = 0;
  calls.warehouseQueries = 0;
  calls.legacyCalls = 0;
  calls.sharedLookupQueries = 0;
}

export const prisma = {
  shopProduct: {
    findMany: async (args = {}) => {
      const sharedLookup = JSON.stringify(args).includes(
        "4-0tfsi-twin-turbo-v8-black-carbon-intake-system"
      );
      if (sharedLookup) {
        calls.sharedLookupQueries += 1;
        return [
          { id: "shared-duplicate", sku: "EVE-4V8TT-CF-INT", slug: "eventuri-legacy" },
          {
            id: "shared-canonical",
            sku: "OTHER",
            slug: "4-0tfsi-twin-turbo-v8-black-carbon-intake-system",
          },
        ];
      }
      calls.warehouseQueries += 1;
      return [
        { id: "warehouse-a", sku: "STOCK-A", slug: "stock-a" },
        { id: "warehouse-b", sku: "STOCK-B", slug: "stock-b" },
      ];
    },
  },
};

export async function getOrCreateShopSettings() {
  return { currencyRates: { EUR: 1, USD: 1, UAH: 40 }, defaultB2bDiscountPercent: 0 };
}
export function getShopSettingsRuntime(value) {
  return value;
}
export async function getCurrentShopCustomerSession() {
  return {
    customerId: "customer-1",
    group: "B2B_APPROVED",
    b2bDiscountPercent: 10,
  };
}
export async function buildShopViewerPricingContextServer() {
  return {
    customerGroup: "B2B_APPROVED",
    customerB2BDiscountPercent: 10,
    defaultB2BDiscountPercent: 0,
    b2bVisibilityMode: "public_dual",
    isAuthenticated: true,
    priceCountry: "DE",
    customerBrandDiscountMap: new Map(),
    systemBrandDiscountMap: new Map(),
  };
}
export async function getShopCatalogCardPricingByIds() {
  return [];
}
export async function queryShopCatalogProjection(query) {
  calls.queries.push(query);
  return { source: "catalog_v2_projection", items: [], hasMore: false, nextCursor: null };
}
export async function queryShopCatalogProjectionFacets(query) {
  calls.facetQueries.push(query);
  return {
    facets: {
      brand: [],
      category: [],
      make: [],
      model: [],
      generation: [],
      year: [],
      engine: [],
      fuel: [],
    },
  };
}

export const SHOP_WAREHOUSE_IN_STOCK_SKUS = ["STOCK"];
export const SHOP_WAREHOUSE_IN_STOCK_SLUGS = ["stock-product"];
export function resolveLocale(locale) {
  return locale === "en" ? "en" : "ua";
}
export const SHOP_CATALOG_CANARY_REQUEST_HEADER = "x-shop-catalog-v2-canary";
export function resolveShopCatalogReaderFlag() {
  return { enabled: true, mode: "ssr", reason: "explicit_ssr" };
}
export function isShopCatalogReaderRequestEnabled() {
  return true;
}
export function canUsePremiumCatalogProjection() {
  return true;
}
export function buildShopCatalogVehicleSearchPlan(params) {
  const constraints = {
    make: params.get("make") || null,
    model: params.get("model") || null,
    generation: params.get("chassis") || params.get("generation") || null,
    year: params.get("year") ? Number(params.get("year")) : null,
    engine: params.get("engine") || null,
    fuel: params.get("fuel") || null,
    opfGpf: params.get("opfGpf") || null,
  };
  const canonical = Boolean(constraints.engine || constraints.fuel || constraints.opfGpf);
  return { constraints, canonical, reader: canonical ? "projection" : "legacy" };
}
export async function resolveLegacyVehicleProductIds() {
  calls.legacyCalls += 1;
  return ["legacy-id", "legacy-stock-id"];
}
export const EVENTURI_SHARED_V8_INTAKE_SKU = "EVE-4V8TT-CF-INT";
export const EVENTURI_SHARED_V8_INTAKE_SLUG = "4-0tfsi-twin-turbo-v8-black-carbon-intake-system";
export const EVENTURI_SHARED_V8_INTAKE_SLUGS = [EVENTURI_SHARED_V8_INTAKE_SLUG];
export function isEventuriSharedV8Intake(sku) {
  return sku?.toUpperCase() === EVENTURI_SHARED_V8_INTAKE_SKU;
}
export function matchesEventuriSharedV8Application(make, model) {
  const models = {
    audi: ["q8", "sq7", "sq8", "rsq8"],
    lamborghini: ["urus"],
    porsche: ["cayenne"],
    bentley: ["bentayga"],
  };
  const values = models[make?.toLowerCase()];
  return Boolean(values && (!model || values.includes(model.toLowerCase())));
}
export function observeShopCatalogRead({ execute }) {
  return execute().then((value) => ({ value }));
}
export function buildShopStorefrontProductPath() {
  return "/product";
}
export function getKwCardTitle({ title }) {
  return title;
}
export function getProductDisplayBrand(value) {
  return value;
}
export function isEuropePricingCountry(country) {
  return country === "DE";
}

export async function getShopInStockProducts() {
  return prisma.shopProduct.findMany();
}
