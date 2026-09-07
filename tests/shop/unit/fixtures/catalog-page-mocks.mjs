export const calls =
  globalThis.__catalogPageMockCalls ??
  (globalThis.__catalogPageMockCalls = {
    queries: [],
    facetQueries: [],
    warehouseQueries: 0,
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
}

export const prisma = {
  shopProduct: {
    findMany: async () => {
      calls.warehouseQueries += 1;
      return [{ id: "warehouse-a" }, { id: "warehouse-b" }];
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
