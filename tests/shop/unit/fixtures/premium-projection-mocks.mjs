export const state =
  globalThis.__premiumProjectionMockState ??
  (globalThis.__premiumProjectionMockState = {
    legacyCalls: 0,
    queries: [],
    facetQueries: [],
    countQueries: [],
    productFindManyCalls: 0,
    settingsCalls: 0,
  });

export function reset() {
  state.legacyCalls = 0;
  state.queries.length = 0;
  state.facetQueries.length = 0;
  state.countQueries.length = 0;
  state.productFindManyCalls = 0;
  state.settingsCalls = 0;
}

export const prisma = {
  shopProduct: {
    findMany: async () => {
      state.productFindManyCalls += 1;
      return [
        { id: "warehouse-a", sku: "SKU-A", slug: "a" },
        { id: "warehouse-b", sku: "SKU-B", slug: "b" },
        { id: "shared-duplicate", sku: "SHARED", slug: "duplicate-shared" },
      ];
    },
  },
};

export async function getOrCreateShopSettings() {
  state.settingsCalls += 1;
  return { currencyRates: { USD: 1, UAH: 40 } };
}
export function getShopSettingsRuntime(value) {
  return value;
}
export async function getCurrentShopCustomerSession() {
  return null;
}
export async function resolveLegacyVehicleProductIds() {
  state.legacyCalls += 1;
  return ["legacy-id"];
}
export function isEuropePricingCountry() {
  return false;
}
export const SHOP_WAREHOUSE_IN_STOCK_SKUS = [];
export const SHOP_WAREHOUSE_IN_STOCK_SLUGS = [];
export function isShopWarehouseInStockProduct() {
  return true;
}
export const EVENTURI_SHARED_V8_INTAKE_SLUG = "eventuri-shared";
export const EVENTURI_SHARED_V8_INTAKE_SLUGS = [];
export function isEventuriSharedV8Intake(sku) {
  return sku === "SHARED";
}
export function matchesEventuriSharedV8Application() {
  return false;
}
export function getProductDisplayBrand(value) {
  return value;
}
export function getKwCardTitle({ title }) {
  return title;
}
export function buildShopStorefrontProductPath(locale, { slug }) {
  return `/${locale}/shop/${slug}`;
}
export function expandShopPrices(value) {
  return { eur: value?.eur ?? 0, usd: value?.usd ?? 0, uah: value?.uah ?? 0 };
}
export async function buildShopViewerPricingContextServer() {
  return {};
}
export function resolveShopProductPricing() {
  return null;
}
export async function getShopCatalogCardPricingByIds() {
  return [];
}

export async function queryShopCatalogProjection(query) {
  state.queries.push(query);
  return { items: [], hasMore: false, nextCursor: null, source: "catalog_v2_projection" };
}
export async function queryShopCatalogProjectionFacets(query) {
  state.facetQueries.push(query);
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
export async function countShopCatalogProjection(query) {
  state.countQueries.push(query);
  return 0;
}
