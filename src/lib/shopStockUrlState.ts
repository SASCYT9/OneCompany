import { parseShopStockParamList } from "./shopStockSearchParams";

export type ShopStockUrlState = {
  view: "grid" | "list";
  page: number;
  query: string;
  brands: string[];
  stock: "all" | "inStock" | "preOrder";
  sort: "default" | "price_asc" | "price_desc" | "name_asc";
  category: string;
  productType: string;
  year: number | null;
  engine: string;
  fuel: string;
  opfGpf: "with" | "without" | null;
  productKind: string | null;
  strict: boolean;
  minPrice: string;
  maxPrice: string;
  currency: "EUR" | "USD" | "UAH" | null;
  vehicleMode: "auto" | "moto";
  make: string;
  model: string;
  chassis: string;
};

type SearchParamReader = {
  get(name: string): string | null;
  getAll(name: string): string[];
};

const trimParam = (params: SearchParamReader, name: string) => params.get(name)?.trim() ?? "";

function parseYear(params: SearchParamReader, currentYear: number) {
  const parsed = Number(params.get("year"));
  return Number.isInteger(parsed) && parsed >= 1886 && parsed <= currentYear + 2 ? parsed : null;
}

function parseCurrency(params: SearchParamReader): ShopStockUrlState["currency"] {
  const value = params.get("currency")?.toUpperCase();
  return value === "EUR" || value === "USD" || value === "UAH" ? value : null;
}

/**
 * Parse the public catalog URL once for both initial hydration and browser history.
 * Keeping this pure prevents popstate handling from drifting from the first render.
 */
export function parseShopStockUrlState(
  params: SearchParamReader,
  currentYear = new Date().getFullYear()
): ShopStockUrlState {
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const stock = params.get("stock");
  const sort = params.get("sort");
  const view = params.get("view");
  const opfGpf = params.get("opfGpf");

  return {
    view: view === "list" ? "list" : "grid",
    page,
    query: params.get("q") ?? "",
    brands: parseShopStockParamList(params, "brand").slice(0, 1),
    stock: stock === "inStock" || stock === "preOrder" ? stock : "all",
    sort: sort === "price_asc" || sort === "price_desc" || sort === "name_asc" ? sort : "default",
    category: trimParam(params, "category"),
    productType: trimParam(params, "productType").slice(0, 120),
    year: parseYear(params, currentYear),
    engine: trimParam(params, "engine"),
    fuel: trimParam(params, "fuel"),
    opfGpf: opfGpf === "with" || opfGpf === "without" ? opfGpf : null,
    productKind: params.get("productKind"),
    strict: params.get("strict") === "1",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    currency: parseCurrency(params),
    vehicleMode: params.get("scope") === "moto" ? "moto" : "auto",
    make: params.get("make") ?? "",
    model: params.get("model") ?? "",
    chassis: params.get("chassis") ?? "",
  };
}
