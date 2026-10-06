import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWheelForcePriceFields,
  calculateWheelForcePrices,
} from "../../../src/lib/wheelforcePricing";
import { normalizeAdminProductPayload } from "../../../src/lib/shopAdminCatalog";

const rates = { EUR: 1, USD: 1.152174, UAH: 53 };

test("WheelForce staging carries the supplier EUR source for both the product and variant", () => {
  const manual = {
    EUR: 1,
    USD: 1.14,
    UAH: 51.5,
    _rawUsdToUah: 45.5,
    _uahReserve: 0,
    _manualCross: 1,
  };
  const fields = buildWheelForcePriceFields(42.5, manual);
  assert.equal(fields.priceSourceCurrency, "EUR");
  assert.equal(fields.priceUsd, 53.3);
  assert.equal(fields.priceUah, 2407.63);
  const { data, errors } = normalizeAdminProductPayload({
    slug: "synthetic-wheel-set",
    titleEn: "Synthetic set",
    ...fields,
    variants: [{ isDefault: true, ...fields }],
  });
  assert.deepEqual(errors, []);
  assert.equal(data.priceSourceCurrency, "EUR");
  assert.equal(data.variants[0].priceSourceCurrency, "EUR");
});

test("WheelForce set price applies 10% for Ukraine and keeps the Europe VAT base separate", () => {
  const prices = calculateWheelForcePrices(3280, rates);
  assert.deepEqual(prices.ukraine, { eur: 3608, usd: 4157, uah: 191224 });
  assert.equal(prices.europe.eur, 2756.3);
  assert.equal(Math.round(prices.europe.eur * 1.19 * 100) / 100, 3280);
});

test("WheelForce accessory keeps cents until the final currency conversion", () => {
  const prices = calculateWheelForcePrices(42.5, rates);
  assert.equal(prices.ukraine.eur, 46.75);
  assert.equal(prices.ukraine.uah, 2478);
  assert.equal(prices.europe.eur, 35.71);
  assert.equal(calculateWheelForcePrices(42.5, { ...rates, UAH: 52.4 }).ukraine.uah, 2450);
});
