import test from "node:test";
import assert from "node:assert/strict";
import {
  getShopStockItemCompareAtSet,
  getShopStockItemPriceSet,
} from "../../../src/lib/shopStockItemPricing";
import { convertShopMoney } from "../../../src/lib/shopMoneyFormat";

const rates = { EUR: 1, USD: 51.483 / 46.0564, UAH: 50.483, _rawUsdToUah: 45.0564, _uahReserve: 1 };

test("catalog browser adapter retains the source and renders API prices under NBU +1", () => {
  const price = getShopStockItemPriceSet({
    price: 1955.08,
    priceSet: {
      eur: 1749,
      usd: 1955.08,
      uah: 90043.77,
      sourceCurrency: "EUR",
    },
  });
  assert.equal(convertShopMoney(price, "UAH", rates), 90043.77);
  assert.equal(convertShopMoney(price, "USD", rates), 1955.08);
});

test("catalog browser adapter retains original unit precision and quantity", () => {
  const price = getShopStockItemPriceSet({
    price: null,
    priceSet: {
      eur: 4.49,
      usd: 5,
      uah: 230.28,
      sourceCurrency: "USD",
      sourceUnitAmount: 1.25,
      sourceQuantity: 4,
    },
  });
  assert.equal(convertShopMoney(price, "UAH", rates), 230.28);
  assert.equal(convertShopMoney(price, "USD", rates), 5);
});

test("legacy single-currency catalog prices keep their supported fallback", () => {
  assert.equal(convertShopMoney(getShopStockItemPriceSet({ price: 10 }), "UAH", rates), 460.56);
});

test("catalog cards only render a strike-through when the product has a real compare-at value", () => {
  assert.equal(getShopStockItemCompareAtSet({ originalPrice: null, originalPriceSet: null }), null);
  assert.equal(
    getShopStockItemCompareAtSet({
      originalPrice: null,
      originalPriceSet: { eur: 0, usd: 100, uah: 0, sourceCurrency: "USD" },
    })?.sourceCurrency,
    "USD"
  );
  assert.deepEqual(getShopStockItemCompareAtSet({ originalPrice: 13, originalPriceSet: null }), {
    eur: 0,
    usd: 13,
    uah: 0,
  });
});
