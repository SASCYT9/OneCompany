import type { ShopCatalogProjectionQueryInput } from "./shopCatalogProjectionQuery.server";

type ShopCatalogFilterQuery = ShopCatalogProjectionQueryInput & {
  brands?: readonly string[];
  scope?: string | null;
  stock?: string | null;
  productType?: string | null;
  productKind?: string | null;
  order?: string | null;
  priceCurrency?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  country?: string | null;
  facetMode?: string | null;
  strict?: boolean;
  useEuropePrice?: boolean;
};

export type ShopCatalogFilterName =
  "brand" | "category" | "make" | "model" | "generation" | "engine" | "fuel";
export type ShopCatalogFilterState = Record<ShopCatalogFilterName, string> & {
  q: string;
  year: string;
  brands?: readonly string[];
  /** Query dimensions rendered outside the compact facet controls. */
  scope?: string | null;
  stock?: string | null;
  productType?: string | null;
  productKind?: string | null;
  sort?: string | null;
  currency?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  country?: string | null;
  facetMode?: string | null;
  strict?: boolean;
  useEuropePrice?: boolean;
};

export const SHOP_CATALOG_FILTER_DESCENDANTS: Readonly<
  Record<ShopCatalogFilterName, readonly (ShopCatalogFilterName | "year")[]>
> = Object.freeze({
  brand: ["make", "model", "generation", "year", "engine", "fuel"],
  category: [],
  make: ["model", "generation", "year", "engine", "fuel"],
  model: ["generation", "year", "engine", "fuel"],
  generation: ["year", "engine", "fuel"],
  engine: ["fuel"],
  fuel: [],
});

export function shopCatalogFilterStateFromQuery(
  query: ShopCatalogFilterQuery
): ShopCatalogFilterState {
  return {
    q: query.text ?? "",
    ...(query.brands?.length ? { brands: [...query.brands] } : {}),
    brand: query.brand ?? "",
    category: query.category ?? "",
    make: query.make ?? "",
    model: query.model ?? "",
    generation: query.generation ?? "",
    year: query.year == null ? "" : String(query.year),
    engine: query.engine ?? "",
    fuel: query.fuel ?? "",
    scope: query.scope ?? null,
    stock: query.stock && query.stock !== "all" ? query.stock : null,
    productType: query.productType ?? null,
    productKind: query.productKind ?? null,
    sort: query.order && query.order !== "default" ? query.order : null,
    currency: query.priceCurrency && query.priceCurrency !== "USD" ? query.priceCurrency : null,
    minPrice: query.minPrice == null ? null : String(query.minPrice),
    maxPrice: query.maxPrice == null ? null : String(query.maxPrice),
    country: query.country ?? null,
    facetMode: query.facetMode && query.facetMode !== "filtered" ? query.facetMode : null,
    strict: query.strict === true,
    useEuropePrice: query.useEuropePrice === true,
  };
}

export function applyShopCatalogFilterChange(
  current: ShopCatalogFilterState,
  name: ShopCatalogFilterName,
  value: string
): ShopCatalogFilterState {
  const next = { ...current, [name]: value };
  if (name === "brand" && current.brands) next.brands = value.trim() ? [value.trim()] : [];
  for (const child of SHOP_CATALOG_FILTER_DESCENDANTS[name]) next[child] = "";
  return next;
}

export function buildShopCatalogFilterHref(locale: "ua" | "en", state: ShopCatalogFilterState) {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  const brands = state.brands?.map((value) => value.trim()).filter(Boolean) ?? [];
  if (brands.length) {
    for (const brand of brands) params.append("brand", brand);
  } else if (state.brand.trim()) {
    params.set("brand", state.brand.trim());
  }
  for (const key of [
    "category",
    "make",
    "model",
    "generation",
    "year",
    "engine",
    "fuel",
  ] as const) {
    const value = state[key];
    if (value.trim()) params.set(key, value.trim());
  }
  const optionalStrings = [
    "scope",
    "stock",
    "productType",
    "productKind",
    "sort",
    "currency",
    "minPrice",
    "maxPrice",
    "country",
    "facetMode",
  ] as const;
  for (const key of optionalStrings) {
    const value = state[key];
    if (typeof value === "string" && value.trim()) params.set(key, value.trim());
  }
  if (state.strict) params.set("strict", "1");
  if (state.useEuropePrice) params.set("europePrice", "1");
  return `/${locale}/shop/catalog${params.size ? `?${params}` : ""}`;
}
