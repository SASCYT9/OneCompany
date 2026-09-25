import assert from "node:assert/strict";
import test from "node:test";

import {
  ATOMIC_MOTO_DISCOUNT_PERCENT,
  ATOMIC_UAH_PER_EUR,
  calculateAtomicPricing,
  parseAtomicPriceUah,
} from "../../../src/lib/atomicFeedPricing";

test("Atomic source UAH converts to EUR at the fixed supplier rate", () => {
  assert.equal(ATOMIC_UAH_PER_EUR, 52);
  assert.deepEqual(calculateAtomicPricing(84_469.28, "other"), {
    priceUah: 84_469.28,
    priceEur: 1_624.41,
    compareAtUah: 84_469.28,
    compareAtEur: 1_624.41,
  });
});

test("the 3% supplier discount applies only to Moto products", () => {
  assert.equal(ATOMIC_MOTO_DISCOUNT_PERCENT, 3);
  assert.deepEqual(calculateAtomicPricing(84_469.28, "moto"), {
    priceUah: 81_935.2,
    priceEur: 1_575.68,
    compareAtUah: 84_469.28,
    compareAtEur: 1_624.41,
  });

  const auto = calculateAtomicPricing(84_469.28, "other");
  assert.equal(auto?.priceUah, 84_469.28);
  assert.equal(auto?.priceEur, 1_624.41);
});

test("Atomic feed prices parse common decimal and thousands formats", () => {
  assert.equal(parseAtomicPriceUah({ price_uah: "84 469,28" }), 84_469.28);
  assert.equal(parseAtomicPriceUah({ price: "84,469.28" }), 84_469.28);
  assert.equal(parseAtomicPriceUah({ price_uah: "84.469,28" }), 84_469.28);
  assert.equal(parseAtomicPriceUah({ price_uah: "0" }), undefined);
});
