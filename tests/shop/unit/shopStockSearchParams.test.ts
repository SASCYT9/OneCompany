import test from "node:test";
import assert from "node:assert/strict";

import { parseShopStockParamList } from "../../../src/lib/shopStockSearchParams";

test("parseShopStockParamList supports comma-separated values", () => {
  const params = new URLSearchParams("brand=Remus,Burger%20Motorsports");

  assert.deepEqual(parseShopStockParamList(params, "brand"), ["Remus", "Burger Motorsports"]);
});

test("parseShopStockParamList supports repeated values and removes duplicates", () => {
  const params = new URLSearchParams();
  params.append("brand", "Remus");
  params.append("brand", "Burger Motorsports");
  params.append("brand", " remus ");

  assert.deepEqual(parseShopStockParamList(params, "brand"), ["Remus", "Burger Motorsports"]);
});

test("parseShopStockParamList ignores empty fragments", () => {
  const params = new URLSearchParams("brand=Remus,,%20,Burger%20Motorsports");

  assert.deepEqual(parseShopStockParamList(params, "brand"), ["Remus", "Burger Motorsports"]);
});
