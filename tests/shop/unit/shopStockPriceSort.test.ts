import assert from "node:assert/strict";
import test from "node:test";
import { compareShopStockPriceAmounts } from "../../../src/lib/shopStockPriceSort";

test("price order follows the selected currency and leaves quote-only products last", () => {
  const items = [
    { id: "a", EUR: 300, USD: 100 },
    { id: "quote", EUR: 0, USD: 0 },
    { id: "b", EUR: 100, USD: 200 },
  ];
  for (const currency of ["EUR", "USD"] as const) {
    const ascending = [...items].sort((a, b) =>
      compareShopStockPriceAmounts(a[currency], b[currency], "asc")
    );
    const descending = [...items].sort((a, b) =>
      compareShopStockPriceAmounts(a[currency], b[currency], "desc")
    );
    assert.deepEqual(
      ascending.map((item) => item.id),
      currency === "EUR" ? ["b", "a", "quote"] : ["a", "b", "quote"]
    );
    assert.deepEqual(
      descending.map((item) => item.id),
      currency === "EUR" ? ["a", "b", "quote"] : ["b", "a", "quote"]
    );
  }
  for (const direction of ["asc", "desc"] as const) {
    assert.equal(compareShopStockPriceAmounts(0, Number.NaN, direction), 0);
    assert.equal(compareShopStockPriceAmounts(-1, 50, direction), 1);
  }
});
