export const SHOP_STOCK_TEXT_SEARCH_DEBOUNCE_MS = 250;

export function resolveShopStockSearchDelay(input: {
  isInitialSearch: boolean;
  isScopeSearchImmediate: boolean;
  isTextChange?: boolean;
}) {
  return input.isInitialSearch || input.isScopeSearchImmediate || input.isTextChange === false
    ? 0
    : SHOP_STOCK_TEXT_SEARCH_DEBOUNCE_MS;
}
