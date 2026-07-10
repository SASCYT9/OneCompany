import test from "node:test";
import assert from "node:assert/strict";

import { convertShopCurrencyAmount } from "../../../src/lib/shopMoneyFormat";

const rates = { EUR: 1, USD: 1.152174, UAH: 53 };

test("converts scalar price filters through EUR rates", () => {
  assert.equal(convertShopCurrencyAmount(1000, "EUR", "USD", rates), 1152.17);
  assert.equal(convertShopCurrencyAmount(1000, "EUR", "UAH", rates), 53000);
  assert.equal(convertShopCurrencyAmount(53000, "UAH", "EUR", rates), 1000);
});

test("keeps an amount stable when currency does not change", () => {
  assert.equal(convertShopCurrencyAmount(1250.5, "USD", "USD", rates), 1250.5);
});

test("does not corrupt an amount when rates are unavailable", () => {
  assert.equal(convertShopCurrencyAmount(500, "EUR", "USD", null), 500);
});
