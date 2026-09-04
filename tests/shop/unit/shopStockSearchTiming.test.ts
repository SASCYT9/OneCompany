import assert from "node:assert/strict";
import test from "node:test";

import {
  SHOP_STOCK_TEXT_SEARCH_DEBOUNCE_MS,
  resolveShopStockSearchDelay,
} from "../../../src/lib/shopStockSearchTiming";

test("discrete filters do not wait for the text debounce", () => {
  assert.equal(
    resolveShopStockSearchDelay({
      isInitialSearch: false,
      isScopeSearchImmediate: false,
      isTextChange: false,
    }),
    0
  );
  assert.equal(
    resolveShopStockSearchDelay({
      isInitialSearch: false,
      isScopeSearchImmediate: false,
      isTextChange: true,
    }),
    SHOP_STOCK_TEXT_SEARCH_DEBOUNCE_MS
  );
});

test("the first unified catalog search starts immediately", () => {
  assert.equal(
    resolveShopStockSearchDelay({
      isInitialSearch: true,
      isScopeSearchImmediate: false,
    }),
    0
  );
});

test("scope transitions stay immediate while later text searches remain debounced", () => {
  assert.equal(
    resolveShopStockSearchDelay({
      isInitialSearch: false,
      isScopeSearchImmediate: true,
    }),
    0
  );
  assert.equal(
    resolveShopStockSearchDelay({
      isInitialSearch: false,
      isScopeSearchImmediate: false,
    }),
    SHOP_STOCK_TEXT_SEARCH_DEBOUNCE_MS
  );
});
