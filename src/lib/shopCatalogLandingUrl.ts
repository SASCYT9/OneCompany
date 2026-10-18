import landingKeys from "@/data/shopCatalogLandingKeys.json";

/**
 * Catalog state ↔ catalog landing pages (see shopCatalogLandings.ts). Kept
 * apart from the landing list so the browser catalog ships only this small
 * filter → path index, generated with the list.
 */
export type ShopCatalogLandingState = {
  /** The landing page path, e.g. `/ua/shop/catalog/bmw/m3`. */
  href: string;
  /** The filters the landing page fixes, as catalog URL parameters. */
  filters: Readonly<Record<string, string>>;
};

/** The only filters a landing page fixes, in key order. */
const LANDING_FILTERS = ["brand", "category", "make", "model"] as const;
/** Parameters that do not change which products a page lists. */
const URL_ONLY_PARAMS = new Set(["page", "view", "includeFitment"]);

const LANDING_PATHS = landingKeys as Readonly<Record<string, string>>;

export function shopCatalogLandingFilterKey(filters: {
  brand?: string | null;
  category?: string | null;
  make?: string | null;
  model?: string | null;
}): string {
  return LANDING_FILTERS.map((key) => (filters[key] ?? "").trim()).join("|");
}

/** The landing path (`catalog/bmw/m3`) for exactly these filters, or null. */
function landingPathForParams(params: URLSearchParams): string | null {
  const filterKeys = [...new Set(params.keys())].filter((key) => !URL_ONLY_PARAMS.has(key));
  if (filterKeys.some((key) => !(LANDING_FILTERS as readonly string[]).includes(key))) return null;
  if (filterKeys.some((key) => params.getAll(key).length !== 1)) return null;
  const key = shopCatalogLandingFilterKey(
    Object.fromEntries(LANDING_FILTERS.map((name) => [name, params.get(name)]))
  );
  return LANDING_PATHS[key] ?? null;
}

function withListingParams(href: string, params: URLSearchParams): string {
  const rest = new URLSearchParams();
  for (const key of ["page", "view"]) {
    const value = params.get(key);
    if (value && !(key === "page" && value === "1")) rest.set(key, value);
  }
  const query = rest.toString();
  return query ? `${href}?${query}` : href;
}

/** The landing page URL (with `page`/`view`) for exactly these catalog filters, or null. */
export function findShopCatalogLandingUrl(locale: string, params: URLSearchParams): string | null {
  const path = landingPathForParams(params);
  return path ? withListingParams(`/${locale}/shop/${path}`, params) : null;
}

/**
 * Where the catalog writes its state: the landing URL while the filters are
 * exactly those of a landing page (only `page` and `view` stay parameters),
 * otherwise the general catalog with its query string.
 */
export function resolveShopCatalogStateUrl(
  locale: string,
  params: URLSearchParams,
  landing: ShopCatalogLandingState | null | undefined
): string {
  if (landing) {
    const filterKeys = [...new Set(params.keys())].filter((key) => !URL_ONLY_PARAMS.has(key));
    const expected = Object.entries(landing.filters);
    const same =
      filterKeys.length === expected.length &&
      expected.every(([key, value]) => params.get(key) === value);
    if (same) return withListingParams(landing.href, params);
  }
  const path = landingPathForParams(params);
  if (path) return withListingParams(`/${locale}/shop/${path}`, params);
  const query = params.toString();
  return `/${locale}/shop/catalog${query ? `?${query}` : ""}`;
}

/**
 * A filtered general-catalog URL whose filters are exactly a landing page's
 * (`/ua/shop/catalog?make=BMW&model=M3`) answers with a permanent redirect
 * to that page, so links and search engines end up on one address.
 */
export function resolveShopCatalogLandingRedirect(
  pathname: string,
  searchParams: URLSearchParams
): string | null {
  const locale = pathname.match(/^\/(ua|en)\/shop\/catalog$/)?.[1];
  if (!locale || !searchParams.size) return null;
  const path = landingPathForParams(searchParams);
  return path ? withListingParams(`/${locale}/shop/${path}`, searchParams) : null;
}
