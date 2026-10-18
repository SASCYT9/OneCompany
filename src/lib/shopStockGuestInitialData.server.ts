import { unstable_cache } from "next/cache";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { resolveLocale } from "@/lib/seo";
import { searchShopStock } from "@/lib/shopStockSearch.server";
import {
  buildStockInitialSearch,
  stockPageSearchParams,
  stockSearchCacheKey,
  type StockPageSearchParams,
} from "@/lib/shopStockInitialSearch";
import type { StockInitialData, StockSearchResponse } from "@/lib/shopStockSearchTypes";

/** The browser catalog starts in the currency of `ShopCurrencyProvider` in the locale layout. */
const CATALOG_INITIAL_CURRENCY = "UAH";
/** The client's audience key for a visitor without a customer session. */
const GUEST_AUDIENCE_KEY = JSON.stringify(["", ""]);

/** Guests share one cached search per filter set, like the API's 60-second CDN cache. */
const readGuestCatalogPage = unstable_cache(
  async (request: string): Promise<StockSearchResponse> => {
    // Reuse the API's exact reader and pricing pipeline in-process with guest
    // pricing. Do not perform an HTTP fetch back into this deployment.
    const response = await searchShopStock(
      { url: `https://onecompany.global/api/shop/stock/search?${request}` },
      { anonymous: true }
    );
    if (!response.ok) throw new Error(`Catalog initial search returned ${response.status}`);
    const data = (await response.json()) as StockSearchResponse;
    if (!Array.isArray(data.data)) throw new Error("Catalog initial search response invalid");
    return data;
  },
  ["shop-catalog-guest-first-page-v1"],
  { revalidate: 60, tags: ["shop-products", "shop-warehouse-products"] }
);

/**
 * The guest search for a filter set (first page unless `page` is given),
 * shared with the catalog's first render through the same 60-second cache.
 */
export function readGuestCatalogSearch(
  locale: string,
  query: StockPageSearchParams
): Promise<StockSearchResponse> {
  const request = buildStockInitialSearch(
    stockPageSearchParams(query),
    resolveLocale(locale),
    CATALOG_INITIAL_CURRENCY
  );
  return readGuestCatalogPage(request.toString());
}

/**
 * The catalog's first result page for a guest, keyed exactly like the
 * client's own first request so the browser reuses it instead of searching
 * again. Signed-in customers get `undefined`: their personal prices keep
 * loading in the browser, as before.
 */
export async function loadGuestCatalogInitialData(
  locale: string,
  searchParams: Promise<StockPageSearchParams>
): Promise<StockInitialData | undefined> {
  const [query, session] = await Promise.all([searchParams, getCurrentShopCustomerSession()]);
  if (session) return undefined;
  const request = buildStockInitialSearch(
    stockPageSearchParams(query),
    resolveLocale(locale),
    CATALOG_INITIAL_CURRENCY
  );
  return {
    response: await readGuestCatalogPage(request.toString()),
    requestKey: `${GUEST_AUDIENCE_KEY}|${stockSearchCacheKey(request)}`,
    audienceKey: GUEST_AUDIENCE_KEY,
    isB2B: false,
  };
}
