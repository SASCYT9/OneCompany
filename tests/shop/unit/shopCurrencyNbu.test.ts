import test from "node:test";
import assert from "node:assert/strict";
import { buildShopCurrencyRatesFromNbu } from "../../../src/lib/shopCurrencyNbu";
import { defaultCurrencyForShopCountry } from "../../../src/lib/shopCountryCurrency";
import { expandShopPrices } from "../../../src/lib/shopPriceConversion";

test("preserve raw NBU evidence and derive the sale cross from both one-hryvnia reserves", () => {
  const rounded = buildShopCurrencyRatesFromNbu({ rate: 48.2, exchangedate: "03.10.2026" }, { rate: 43, exchangedate: "03.10.2026" });
  assert.equal(rounded.currencyRates.UAH, 48.2);
  assert.equal(rounded.currencyRates._uahReserve, 1);
  assert.equal(rounded.currencyRates._rawUsdToUah, 43);
  assert.equal('_mixedSourceCurrency' in rounded.currencyRates, false);
  assert.equal(rounded.eurToUah, 48.2);
  assert.equal(rounded.currencyRates.USD, Number((49.2 / 44).toFixed(12)));
  assert.equal(rounded.rawUsdPerEur, Number((48.2 / 43).toFixed(12)));
  assert.equal(rounded.currencyRates._rawUsdPerEur, rounded.rawUsdPerEur);
  assert.equal(buildShopCurrencyRatesFromNbu({ rate: 48, exchangedate: "03.10.2026" }, { rate: 43, exchangedate: "03.10.2026" }).currencyRates.UAH, 48);
});
test("reject mismatched dates and invalid rates instead of replacing the price book", () => {
  assert.throws(() => buildShopCurrencyRatesFromNbu({ rate: 48, exchangedate: "03.10.2026" }, { rate: 43, exchangedate: "02.10.2026" }));
  assert.throws(() => buildShopCurrencyRatesFromNbu({ rate: NaN, exchangedate: "03.10.2026" }, { rate: 43, exchangedate: "03.10.2026" }));
});
test("a fresh calculation starts from source money and preserves independent explicit prices", () => {
  const source = { eur: 10, usd: 0, uah: 0 };
  assert.equal(expandShopPrices(source, { EUR: 1, USD: 1.1, UAH: 48 }).uah, 480);
  assert.equal(expandShopPrices(source, { EUR: 1, USD: 1.1, UAH: 49 }).uah, 490);
  assert.equal(source.uah, 0);
  assert.equal(expandShopPrices({ ...source, uah: 500 }, { EUR: 1, USD: 1.1, UAH: 49 }).uah, 500);
});
test("initial currency follows the chosen country", () => {
  assert.equal(defaultCurrencyForShopCountry("Ukraine"), "UAH");
  assert.equal(defaultCurrencyForShopCountry("Germany"), "EUR");
  assert.equal(defaultCurrencyForShopCountry("United States"), "USD");
});
