import test from "node:test";
import assert from "node:assert/strict";

import { diversifyShopStockItems } from "../../../src/lib/shopStockRanking";

test("diversifyShopStockItems alternates brands before repeating one", () => {
  const items = [
    { id: "a-1", brand: "A", score: 10 },
    { id: "a-2", brand: "A", score: 9 },
    { id: "b-1", brand: "B", score: 8 },
    { id: "c-1", brand: "C", score: 7 },
  ];

  const result = diversifyShopStockItems(items, (item) => ({
    brand: item.brand,
    score: item.score,
    stableKey: item.id,
  }));

  assert.deepEqual(
    result.map((item) => item.id),
    ["a-1", "b-1", "c-1", "a-2"]
  );
});

test("diversifyShopStockItems preserves quality order inside each brand", () => {
  const items = [
    { id: "a-low", brand: "A", score: 2 },
    { id: "b-top", brand: "B", score: 20 },
    { id: "a-top", brand: "A", score: 12 },
    { id: "b-low", brand: "B", score: 1 },
  ];

  const result = diversifyShopStockItems(items, (item) => ({
    brand: item.brand,
    score: item.score,
    stableKey: item.id,
  }));

  assert.deepEqual(
    result.map((item) => item.id),
    ["b-top", "a-top", "b-low", "a-low"]
  );
});
