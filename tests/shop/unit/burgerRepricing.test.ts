import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateBurgerVariantPrice,
  isBurgerTunerFamily,
  roundBurgerPriceUpToFive,
} from "../../../src/lib/burgerRepricing";

test("Burger cable price uses the larger packed or dimensional weight", () => {
  const result = calculateBurgerVariantPrice({
    productType: "Flex Fuel Kits",
    supplierUsd: 39.95,
    domesticShippingUsd: 7,
    packageEstimate: {
      productKg: 0.6,
      optionAdditions: [],
      packagingKg: 0.2,
      lengthCm: 30.48,
      widthCm: 20.32,
      heightCm: 7.62,
    },
  });
  assert.ok(result.dimensionalKg > result.packedPhysicalKg);
  assert.equal(result.billableKg, 2);
  assert.equal(result.unroundedPriceUsd, 73.99);
  assert.equal(result.priceUsd, 75);
});

test("Burger price rounding and tuner family identification", () => {
  assert.equal(isBurgerTunerFamily("JB4 Tuners"), true);
  assert.equal(isBurgerTunerFamily("JB+ Tuners"), true);
  assert.equal(isBurgerTunerFamily("Stage 1 Tuners"), true);
  assert.equal(isBurgerTunerFamily("Intakes"), false);
  const result = calculateBurgerVariantPrice({
    productType: "JB4 Tuners",
    supplierUsd: 599,
    domesticShippingUsd: 16.5,
    packageEstimate: {
      productKg: 1.4, optionAdditions: [], packagingKg: 0.3,
      lengthCm: 30, widthCm: 25, heightCm: 12,
    },
  });
  assert.equal(result.regularSupplierUsd, 599);
  assert.equal(result.priceUsd, 740);
});

test("bulky Burger intake uses its box volume rather than the supplier weight", () => {
  const result = calculateBurgerVariantPrice({
    productType: "Intakes",
    supplierUsd: 449,
    domesticShippingUsd: 24,
    packageEstimate: {
      productKg: 3.175,
      optionAdditions: [],
      packagingKg: 0.5,
      lengthCm: 45.72,
      widthCm: 25.4,
      heightCm: 25.4,
    },
  });
  assert.equal(result.billableKg, 7);
  assert.equal(result.unroundedPriceUsd, 613.95);
  assert.equal(result.priceUsd, 615);
});

test("BMW intake uses the reviewed 5 kg bare estimate plus packing, 10%, and another kilogram", () => {
  const result = calculateBurgerVariantPrice({
    productType: "Intakes",
    supplierUsd: 449,
    domesticShippingUsd: 24,
    packageEstimate: {
      productKg: 5,
      optionAdditions: [],
      packagingKg: 0.5,
      lengthCm: 45.72,
      widthCm: 25.4,
      heightCm: 25.4,
    },
  });
  assert.equal(result.billableKg, 7);
  assert.equal(result.priceUsd, 615);
});

test("Fuel-It analyzer includes packing before rounding up to five dollars", () => {
  const result = calculateBurgerVariantPrice({
    productType: "Flex Fuel Kits",
    supplierUsd: 199,
    domesticShippingUsd: 10,
    packageEstimate: {
      productKg: 0.454,
      optionAdditions: [],
      packagingKg: 0.2,
      lengthCm: 22.86,
      widthCm: 15.24,
      heightCm: 5.08,
    },
  });
  assert.equal(result.billableKg, 2);
  assert.equal(result.unroundedPriceUsd, 260.35);
  assert.equal(result.priceUsd, 265);
});

test("CPI starter kit uses its regular variant price instead of the sale price", () => {
  const result = calculateBurgerVariantPrice({
    productType: "Port Injection & Manifolds",
    supplierUsd: 299,
    compareAtUsd: 319,
    domesticShippingUsd: 10,
    packageEstimate: {
      productKg: 0.907,
      optionAdditions: [],
      packagingKg: 0.3,
      lengthCm: 27.94,
      widthCm: 22.86,
      heightCm: 15.24,
    },
  });
  assert.equal(result.regularSupplierUsd, 319);
  assert.equal(result.billableKg, 3);
  assert.equal(result.priceUsd, 410);
});

test("selected add-on mass changes the billable weight for the same parent product", () => {
  const base = {
    productType: "Port Injection & Manifolds",
    supplierUsd: 449,
    compareAtUsd: 319,
    domesticShippingUsd: 10,
    packageEstimate: {
      productKg: 0.907,
      optionAdditions: [] as Array<{ name: string; kg: number }>,
      packagingKg: 0.3,
      lengthCm: 27.94,
      widthCm: 22.86,
      heightCm: 15.24,
    },
  };
  const withoutAddOn = calculateBurgerVariantPrice(base);
  const withAddOn = calculateBurgerVariantPrice({
    ...base,
    packageEstimate: {
      ...base.packageEstimate,
      optionAdditions: [{ name: "additional controller", kg: 1 }],
    },
  });
  assert.equal(withoutAddOn.billableKg, 3);
  assert.equal(withoutAddOn.regularSupplierUsd, 449);
  assert.equal(withAddOn.optionAddedKg, 1);
  assert.equal(withAddOn.billableKg, 4);
});

test("Fuel-It ECA add-on raises both the regular variant price and packed weight", () => {
  const result = calculateBurgerVariantPrice({
    productType: "Flex Fuel Kits",
    supplierUsd: 214.95,
    domesticShippingUsd: 7,
    packageEstimate: {
      productKg: 0.6,
      optionAdditions: [{ name: "Fuel-It Bluetooth ECA", kg: 0.454 }],
      packagingKg: 0.2,
      lengthCm: 30.48,
      widthCm: 20.32,
      heightCm: 7.62,
    },
  });
  assert.equal(result.optionAddedKg, 0.454);
  assert.equal(result.billableKg, 3);
  assert.equal(result.priceUsd, 290);
});

test("Burger prices round upward to $5 without raising an exact multiple", () => {
  assert.equal(roundBurgerPriceUpToFive(70.39), 75);
  assert.equal(roundBurgerPriceUpToFive(100), 100);
  assert.equal(roundBurgerPriceUpToFive(100 + Number.EPSILON * 100), 100);
  assert.equal(roundBurgerPriceUpToFive(100.01), 105);
});

test("Burger price rejects missing package dimensions rather than understating shipping", () => {
  assert.throws(() => calculateBurgerVariantPrice({
    productType: "Intakes",
    supplierUsd: 449,
    domesticShippingUsd: 24,
    packageEstimate: {
      productKg: 3.175, optionAdditions: [], packagingKg: 0.5,
      lengthCm: 0, widthCm: 40, heightCm: 25,
    },
  }));
});

test("digital Burger products use regular-price markup without physical shipping weight", () => {
  const result = calculateBurgerVariantPrice({
    productType: "Stage 1 Tuners",
    supplierUsd: 199,
    domesticShippingUsd: 0,
    requiresShipping: false,
    packageEstimate: {
      productKg: 0.8,
      optionAdditions: [],
      packagingKg: 0.3,
      lengthCm: 23,
      widthCm: 18,
      heightCm: 8,
    },
  });
  assert.equal(result.billableKg, 0);
  assert.equal(result.unroundedPriceUsd, 228.85);
  assert.equal(result.priceUsd, 230);
});
