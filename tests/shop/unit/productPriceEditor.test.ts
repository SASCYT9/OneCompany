import test from "node:test";
import assert from "node:assert/strict";

import {
  b2bDiscountForBrand,
  customerMoney,
  discountPercent,
  isAtomicManagedBrand,
  priceBandPatch,
  priceFieldsOf,
  priceFormulaText,
  readPriceBand,
  switchPriceBandCurrency,
  variantPriceDiffers,
} from "../../../src/lib/admin/productPriceEditor";

// Shape of the production price book: manual EUR 51.50 / USD 45.50 sale rates.
const RATES = { EUR: 1, USD: 1.14, UAH: 51.5, _uahReserve: 0, _rawUsdToUah: 45.5 };

test("a stale UAH snapshot never wins over the EUR source the storefront prices from", () => {
  const form = { priceSourceCurrency: "EUR", priceEur: "6207.7", priceUah: "322800.4" };
  assert.deepEqual(readPriceBand(form, "price"), { currency: "EUR", amount: 6207.7, isSet: true });
  const money = customerMoney(form, "price", RATES);
  assert.ok(money);
  assert.equal(Math.round(money.uah), 319697);
});

test("a band without a declared source uses its only amount", () => {
  assert.deepEqual(readPriceBand({ priceUsd: "1200" }, "price"), {
    currency: "USD",
    amount: 1200,
    isSet: true,
  });
  assert.deepEqual(readPriceBand({}, "price"), { currency: null, amount: 0, isSet: false });
});

test("setting a price records its currency as the source and clearing empties the band", () => {
  const patch = priceBandPatch("price", 100, "EUR", RATES);
  assert.equal(patch.priceSourceCurrency, "EUR");
  assert.equal(patch.priceEur, "100");
  assert.equal(Number(patch.priceUah), 5150);

  assert.deepEqual(priceBandPatch("b2bPrice", null, "EUR", RATES), {
    b2bPriceSourceCurrency: "",
    priceEurB2b: "",
    priceUsdB2b: "",
    priceUahB2b: "",
  });
});

test("switching currency keeps today's customer price and makes UAH a fixed amount", () => {
  const form = { priceSourceCurrency: "EUR", priceEur: "100", priceUah: "5300" };
  const patch = switchPriceBandCurrency(form, "price", "UAH", RATES);
  assert.equal(patch.priceSourceCurrency, "UAH");
  assert.equal(patch.priceUah, "5150");
  assert.deepEqual(switchPriceBandCurrency({}, "price", "USD", RATES), {});
  assert.match(priceFormulaText("UAH", RATES), /Фіксована/);
  assert.match(priceFormulaText("EUR", RATES), /51\.50 грн/);
});

test("a single variant copies every price band so card and cart agree", () => {
  const product = {
    priceSourceCurrency: "EUR",
    priceEur: "100",
    priceUsd: "",
    priceUah: "",
    priceEurEurope: "90",
  };
  const fields = priceFieldsOf(product);
  assert.equal(fields.priceEur, "100");
  assert.equal(fields.priceEurEurope, "90");
  assert.equal(fields.b2bPriceSourceCurrency, "");
  assert.equal(variantPriceDiffers(product, fields, RATES), false);
  assert.equal(
    variantPriceDiffers(product, { priceSourceCurrency: "EUR", priceEur: "120" }, RATES),
    true
  );
});

test("B2B explanation follows the brand rule before the global default", () => {
  const context = { defaultB2bDiscountPercent: 5, brandB2bDiscounts: { akrapovic: 15 } };
  assert.deepEqual(b2bDiscountForBrand("AKRAPOVIC", context), { percent: 15, source: "brand" });
  assert.deepEqual(b2bDiscountForBrand("Eventuri", context), { percent: 5, source: "default" });
  assert.equal(
    b2bDiscountForBrand("Eventuri", { defaultB2bDiscountPercent: null, brandB2bDiscounts: {} }),
    null
  );
});

test("only a higher old price counts as a sale; Atomic brands are flagged as feed-managed", () => {
  assert.equal(discountPercent(80, 100), 20);
  assert.equal(discountPercent(100, 100), null);
  assert.equal(isAtomicManagedBrand(" Akrapovic "), true);
  assert.equal(isAtomicManagedBrand("Eventuri"), false);
});
