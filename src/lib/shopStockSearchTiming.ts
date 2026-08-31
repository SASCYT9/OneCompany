export const SHOP_STOCK_TEXT_SEARCH_DEBOUNCE_MS = 600;

export function resolveShopStockSearchDelay(input: {
  isInitialSearch: boolean;
  isScopeSearchImmediate: boolean;
}) {
  return input.isInitialSearch || input.isScopeSearchImmediate
    ? 0
    : SHOP_STOCK_TEXT_SEARCH_DEBOUNCE_MS;
}
