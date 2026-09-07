import type { ShopCatalogProjectionQueryInput } from "./shopCatalogProjectionQuery.server";

/**
 * The bounded input accepted by every Catalog V2 storefront reader.
 *
 * Keeping transport concerns (URLSearchParams/record values) here means a
 * server page, API route, and cache-key builder cannot each interpret price,
 * stock, or pagination differently. The object is deliberately a DTO: it
 * contains no Prisma or request objects and is safe to pass to pure tests.
 */
type CatalogSearchParamsReader = {
  get(name: string): string | null;
  getAll(name: string): string[];
};

export type CatalogSearchParams =
  Readonly<Record<string, string | string[] | undefined>> | CatalogSearchParamsReader;

export type ShopCatalogStorefrontScope = "auto" | "moto";
export type ShopCatalogStorefrontStock = "all" | "inStock" | "preOrder";
export type ShopCatalogStorefrontOrder =
  "default" | "price_asc" | "price_desc" | "name_asc" | "brand_interleave";
export type ShopCatalogStorefrontCurrency = "EUR" | "USD" | "UAH";
export type ShopCatalogStorefrontFacetMode = "filtered" | "global";

export type ShopCatalogStorefrontQuery = Omit<
  ShopCatalogProjectionQueryInput,
  | "brand"
  | "limit"
  | "offset"
  | "order"
  | "priceCurrency"
  | "scope"
  | "useEuropePrice"
  | "effectivePriceContext"
> & {
  page: number;
  limit: number;
  offset: number;
  after: { stableRank: string; productId: string } | null;
  brands: readonly string[];
  brand: string | null;
  scope: ShopCatalogStorefrontScope | null;
  stock: ShopCatalogStorefrontStock;
  minPrice: number | null;
  maxPrice: number | null;
  priceCurrency: ShopCatalogStorefrontCurrency;
  useEuropePrice: boolean;
  order: ShopCatalogStorefrontOrder;
  productType: string | null;
  productKind: string | null;
  strict: boolean;
  facetMode: ShopCatalogStorefrontFacetMode;
  country: string | null;
};

const MAX_PAGE = 10_000;
const MAX_BRANDS = 32;
const MAX_PRICE = 1_000_000_000;

function isSearchParams(value: CatalogSearchParams): value is CatalogSearchParamsReader {
  return typeof (value as { get?: unknown }).get === "function";
}

function all(params: CatalogSearchParams, name: string): string[] {
  if (isSearchParams(params)) return params.getAll(name);
  const value = params[name];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function first(params: CatalogSearchParams, name: string): string | undefined {
  return all(params, name)[0];
}

function bounded(params: CatalogSearchParams, name: string, max = 320): string | null {
  const normalized = first(params, name)?.trim() ?? "";
  return normalized && normalized.length <= max ? normalized : null;
}

function boundedList(params: CatalogSearchParams, name: string, max = 320): readonly string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of all(params, name)) {
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (!value || value.length > max) continue;
      const key = value.toLocaleLowerCase("en-US");
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(value);
      if (values.length >= MAX_BRANDS) return Object.freeze(values);
    }
  }
  return Object.freeze(values);
}

function positiveInteger(
  params: CatalogSearchParams,
  name: string,
  fallback: number,
  maximum: number
) {
  const value = Number(first(params, name));
  return Number.isSafeInteger(value) && value >= 1 && value <= maximum ? value : fallback;
}

function amount(params: CatalogSearchParams, name: string): number | null {
  const raw = first(params, name)?.trim() ?? "";
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE ? value : null;
}

function oneOf<T extends string>(
  params: CatalogSearchParams,
  name: string,
  allowed: readonly T[],
  fallback: T
): T {
  const value = first(params, name)?.trim() as T | undefined;
  return value && allowed.includes(value) ? value : fallback;
}

function booleanFlag(params: CatalogSearchParams, name: string): boolean {
  const value = first(params, name)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function year(params: CatalogSearchParams): number | null {
  const value = first(params, "year")?.trim() ?? "";
  if (!/^\d{4}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1886 && parsed <= 2200 ? parsed : null;
}

/** Parse and bound all public Catalog V2 query dimensions in one place. */
export function parseShopCatalogStorefrontQuery(
  locale: "ua" | "en",
  params: CatalogSearchParams
): ShopCatalogStorefrontQuery {
  const limit = positiveInteger(params, "limit", 24, 96);
  const page = positiveInteger(params, "page", 1, MAX_PAGE);
  const afterRank = bounded(params, "afterRank", 64);
  const afterProduct = bounded(params, "afterProduct", 191);
  const after =
    afterRank && afterProduct && /^-?\d+(?:\.\d+)?$/.test(afterRank)
      ? Object.freeze({ stableRank: afterRank, productId: afterProduct })
      : null;
  let minPrice = amount(params, "minPrice");
  let maxPrice = amount(params, "maxPrice");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const brands = boundedList(params, "brand");
  const scopeValue = first(params, "scope")?.trim().toLowerCase();
  const scope: ShopCatalogStorefrontScope | null =
    scopeValue === "auto" || scopeValue === "moto" ? scopeValue : null;
  const order = oneOf(
    params,
    "sort",
    ["default", "price_asc", "price_desc", "name_asc", "brand_interleave"] as const,
    "default"
  );
  const priceCurrency = oneOf(params, "currency", ["EUR", "USD", "UAH"] as const, "USD");
  const offset = after ? 0 : Math.min((page - 1) * limit, 1_000_000);
  const projection = {
    locale,
    limit,
    offset,
    after,
    text: bounded(params, "q", 256),
    scope,
    brand: brands[0] ?? null,
    brands,
    category: bounded(params, "category"),
    make: bounded(params, "make"),
    model: bounded(params, "model"),
    generation: bounded(params, "chassis") ?? bounded(params, "generation"),
    year: year(params),
    engine: bounded(params, "engine"),
    fuel: bounded(params, "fuel"),
    opfGpf: bounded(params, "opfGpf")?.toLowerCase() ?? null,
    productIds: null,
    excludeProductIds: null,
    minPrice,
    maxPrice,
    priceCurrency,
    order,
    orderSeed: null,
    useEuropePrice: booleanFlag(params, "europePrice"),
    page,
    stock: oneOf(params, "stock", ["all", "inStock", "preOrder"] as const, "all"),
    productType: bounded(params, "productType", 120),
    productKind: bounded(params, "productKind", 120),
    strict: booleanFlag(params, "strict"),
    facetMode: oneOf(params, "facetMode", ["filtered", "global"] as const, "filtered"),
    country: bounded(params, "country", 64),
  } satisfies ShopCatalogStorefrontQuery;
  return Object.freeze(projection);
}
