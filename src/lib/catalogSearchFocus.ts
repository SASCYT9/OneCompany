/**
 * On the general catalog page the header shows a "Search" nav item (in place
 * of Blog) that jumps to the catalog's own search field. The header dispatches
 * this event; StockCatalogClient scrolls to and focuses the field.
 */
export const CATALOG_FOCUS_SEARCH_EVENT = "onecompany:catalog-focus-search";

/** Only the localized general catalog URL (rewritten internally to /shop/stock). */
export function isCatalogSearchPath(pathname: string | null | undefined) {
  return /^\/(?:ua|en)\/shop\/(?:catalog|stock)\/?$/.test(pathname ?? "");
}
