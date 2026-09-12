import type { ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { cleanShopAiProductKind } from "@/lib/shopAiProductKind";
import { parseShopStockUrlState } from "@/lib/shopStockUrlState";

export type StockPageSearchParams = Record<string, string | string[] | undefined>;

export function stockPageSearchParams(input: StockPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item);
    }
  }
  return params;
}

export function parseStockPage(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

// Matches the approved client's initial state, including CurrencyContext's
// default region. Browser preferences are applied after hydration as before.
// API-only all/limit/debug parameters must never turn an HTML request into an
// unbounded catalog export.
export function buildStockInitialSearch(
  source: URLSearchParams,
  locale: string,
  currency: ShopCurrencyCode
): URLSearchParams {
  const state = parseShopStockUrlState(source);
  const params = new URLSearchParams();
  const fields = {
    q: state.query,
    brand: state.brands.join(","),
    category: source.get("category") ?? "",
    productType: state.productType,
    make: state.make,
    model: state.model,
    chassis: state.chassis,
    year: state.year ? String(state.year) : "",
    engine: state.engine,
    fuel: state.fuel,
    opfGpf: state.opfGpf,
    productKind: cleanShopAiProductKind(state.productKind),
    strict: state.strict ? "1" : "",
    scope: state.vehicleMode,
    stock: state.stock !== "all" ? state.stock : "",
    minPrice: state.minPrice.trim().replace(",", "."),
    maxPrice: state.maxPrice.trim().replace(",", "."),
    currency,
    sort: state.sort !== "default" ? state.sort : "",
    locale,
    country: currency === "EUR" ? "Germany" : currency === "USD" ? "United States" : "Ukraine",
    page: String(state.page),
  };
  for (const [key, value] of Object.entries(fields)) if (value) params.set(key, value);
  return params;
}

export function stockSearchCacheKey(params: URLSearchParams): string {
  const sorted = new URLSearchParams(params);
  sorted.sort();
  return sorted.toString();
}

export function buildStockPaginationHref(
  locale: string,
  source: { toString(): string },
  page: number
): string {
  const params = new URLSearchParams(source.toString());
  params.delete("page");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${locale}/shop/catalog${query ? `?${query}` : ""}`;
}

const catalogFilterKeys = [
  "q",
  "brand",
  "category",
  "productType",
  "make",
  "model",
  "chassis",
  "year",
  "engine",
  "fuel",
  "opfGpf",
  "productKind",
  "strict",
  "scope",
  "stock",
  "minPrice",
  "maxPrice",
  "sort",
] as const;

export function hasStockCatalogFilters(params: URLSearchParams): boolean {
  return catalogFilterKeys.some((key) => params.getAll(key).some((value) => Boolean(value.trim())));
}
