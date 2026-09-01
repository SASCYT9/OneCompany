import type { ShopCatalogProjectionQueryInput } from "./shopCatalogProjectionQuery.server";

export type ShopCatalogFilterName = "brand" | "category" | "make" | "model" | "generation" | "engine" | "fuel";
export type ShopCatalogFilterState = Record<ShopCatalogFilterName, string> & {
  q: string;
  year: string;
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
  query: ShopCatalogProjectionQueryInput
): ShopCatalogFilterState {
  return {
    q: query.text ?? "",
    brand: query.brand ?? "",
    category: query.category ?? "",
    make: query.make ?? "",
    model: query.model ?? "",
    generation: query.generation ?? "",
    year: query.year == null ? "" : String(query.year),
    engine: query.engine ?? "",
    fuel: query.fuel ?? "",
  };
}

export function applyShopCatalogFilterChange(
  current: ShopCatalogFilterState,
  name: ShopCatalogFilterName,
  value: string
): ShopCatalogFilterState {
  const next = { ...current, [name]: value };
  for (const child of SHOP_CATALOG_FILTER_DESCENDANTS[name]) next[child] = "";
  return next;
}

export function buildShopCatalogFilterHref(locale: "ua" | "en", state: ShopCatalogFilterState) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) if (value.trim()) params.set(key, value.trim());
  return `/${locale}/shop/catalog${params.size ? `?${params}` : ""}`;
}
