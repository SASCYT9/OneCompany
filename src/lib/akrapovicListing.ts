import type { ShopProduct } from "@/lib/shopCatalog";
import { pickShopSortableAmount } from "@/lib/shopDisplayPrices";
import type { ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import {
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";

/**
 * Akrapovič catalog listing helpers shared by `/shop/akrapovic/collections`
 * and its crawlable `/page/N` continuation routes.
 */

export const AKRAPOVIC_LISTING_PAGE_SIZE = 30;
export const AKRAPOVIC_LISTING_BASE_SLUG = "shop/akrapovic/collections";

type QueryValue = string | string[] | undefined;
export type AkrapovicListingSearchParams = Partial<
  Record<"scope" | "segment" | "brand" | "model" | "body" | "year" | "line" | "q", QueryValue>
>;

const FILTER_KEYS = ["brand", "model", "body", "year", "line", "q", "scope", "segment"] as const;

function first(value: QueryValue): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

export function isAkrapovicMotoScope(params: AkrapovicListingSearchParams): boolean {
  return first(params.scope) === "moto" || first(params.segment) === "moto";
}

/**
 * Query string the client filter would read from the URL, built on the server
 * so the first render (and the server HTML) already reflects it.
 */
export function buildAkrapovicInitialQuery(params: AkrapovicListingSearchParams): string {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export function hasAkrapovicListingFilters(params: AkrapovicListingSearchParams): boolean {
  return (["brand", "model", "body", "year", "line", "q"] as const).some((key) =>
    Boolean(first(params[key]))
  );
}

export function resolveAkrapovicPagination(
  productCount: number,
  requestedPage: number,
  pageSize: number = AKRAPOVIC_LISTING_PAGE_SIZE
): { totalPages: number; isValidPage: boolean; page: number } {
  const totalPages = Math.max(1, Math.ceil(productCount / pageSize));
  const isValidPage =
    Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages;
  return { totalPages, isValidPage, page: requestedPage };
}

export function buildAkrapovicListingPath(locale: string, page: number): string {
  const base = `/${locale}/${AKRAPOVIC_LISTING_BASE_SLUG}`;
  return page <= 1 ? base : `${base}/page/${page}`;
}

export type AkrapovicSortOrder = "default" | "price_desc" | "price_asc";

export type AkrapovicSortContext = {
  viewerContext?: ShopViewerPricingContext;
  currency: ShopCurrencyCode;
  rates?: { EUR: number; USD: number; UAH?: number } | null;
};

/**
 * Listing order shared by the client filter and the server (ItemList, page
 * routes): by price, with products that have an image first in the default
 * order. Keeping one comparator means a `/page/N` URL lists the same products
 * a visitor sees after pressing "Show more".
 */
export function sortAkrapovicProducts<T extends ShopProduct>(
  products: readonly T[],
  sortOrder: AkrapovicSortOrder,
  context: AkrapovicSortContext
): T[] {
  const rates = context.rates
    ? { EUR: context.rates.EUR, USD: context.rates.USD, UAH: context.rates.UAH }
    : null;
  const amountOf = (product: T) =>
    pickShopSortableAmount(
      context.viewerContext
        ? resolveShopProductPricing(product, context.viewerContext).effectivePrice
        : product.price,
      context.currency,
      rates
    );

  return [...products].sort((a, b) => {
    const priceA = amountOf(a);
    const priceB = amountOf(b);
    if (sortOrder === "price_desc") return priceB - priceA;
    if (sortOrder === "price_asc") return priceA - priceB;
    const hasImgA = a.image && a.image.length > 5 ? 1 : 0;
    const hasImgB = b.image && b.image.length > 5 ? 1 : 0;
    if (hasImgA !== hasImgB) return hasImgB - hasImgA;
    return priceB - priceA;
  });
}
