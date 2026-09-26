import assert from "node:assert/strict";
import test from "node:test";
import { calculateWheelForcePrices } from "../../../src/lib/wheelforcePricing";

const rates = { EUR: 1, USD: 1.152174, UAH: 53 };

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
