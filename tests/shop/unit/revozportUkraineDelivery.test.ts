import assert from "node:assert/strict";
import test from "node:test";
import { addRevozportUkraineShippingToPriceSet, resolveRevozportUkraineShippingUsd } from "../../../src/lib/revozportShipping";
import { resolveShopProductPricing, buildShopViewerPricingContext } from "../../../src/lib/shopPricingAudience";
import { buildShopSettingsRuntimeFromPayload } from "../../../src/lib/shopAdminSettings";
import { buildCheckoutSettingsPreview } from "../../../src/lib/shopCheckout";

const rates = { EUR: 1, USD: 1.152174, UAH: 53 };
const settings = buildShopSettingsRuntimeFromPayload({ defaultCurrency: "USD", enabledCurrencies: ["EUR", "USD", "UAH"], currencyRates: rates, shippingZones: [{ id: "ua", name: "Ukraine", countries: ["UA"], baseRate: 25, perItemRate: 10, currency: "USD", enabled: true }], taxRegions: [] } as never);

test("Ukraine includes the retained supplier quote after estimated weight was removed", () => {
  const base = { eur: 0, usd: 499, uah: 0 };
  const delivered = addRevozportUkraineShippingToPriceSet(base, "Revozport", "UA", null, rates, 49);
  assert.equal(delivered.usd, 548);
  assert.equal(delivered.uah, 25208);
  assert.equal(delivered.eur, 548 / rates.USD);
  assert.equal(addRevozportUkraineShippingToPriceSet(base, "Revozport", "DE", null, rates, 49), base);
  assert.equal(addRevozportUkraineShippingToPriceSet(base, "do88", "UA", null, rates, 49), base);
  assert.equal(resolveRevozportUkraineShippingUsd(2, 49), 50);
  assert.equal(resolveRevozportUkraineShippingUsd(null, 0), 0);
  assert.equal(resolveRevozportUkraineShippingUsd(null, -49), null);
});

test("shared product pricing and checkout do not charge included freight twice", () => {
  const viewer = buildShopViewerPricingContext(settings, null, false, null, undefined, { priceCountry: "UA" });
  const product = { brand: "Revozport", price: { eur: 0, usd: 499, uah: 0 }, weightKg: null, shippingToUaUsd: 49 };
  const pricing = resolveShopProductPricing(product as never, viewer);
  assert.equal(pricing.effectivePrice.usd, 548);
  const quote = buildCheckoutSettingsPreview(settings, { currency: "USD", subtotal: 548, itemCount: 1, items: [{ total: 548, quantity: 1, brandName: "Revozport", pricingBaseRegion: "default", weightKg: null, shippingToUaUsd: 49, shippingIncludedInPrice: true }], shippingAddress: { country: "UA", city: "Kyiv", line1: "Test" } });
  assert.equal(quote.shippingCost, 0);
  assert.equal(quote.total, 548);
});

test("approved pricing weight overrides the legacy quote without changing physical weight", () => {
  const viewer = buildShopViewerPricingContext(settings, null, false, null, undefined, { priceCountry: "UA" });
  const product = { brand: "Revozport", price: { eur: 0, usd: 499, uah: 0 }, weightKg: null, shippingPricingWeightKg: 5.489, shippingToUaUsd: 49 };
  const pricing = resolveShopProductPricing(product as never, viewer);
  assert.equal(pricing.effectivePrice.usd, 636.23);
  assert.equal(product.weightKg, null);
});

test("managed price book adds Revozport freight only to a USD source and never fails the page", () => {
  const managed = { EUR: 1, USD: 1.16, UAH: 48.5, _uahReserve: 1, _rawUsdToUah: 41.8 };
  const usd = addRevozportUkraineShippingToPriceSet({ eur: 0, usd: 499, uah: 0 }, "Revozport", "UA", null, managed, 49);
  assert.equal(usd.usd, 548);
  assert.equal(usd.sourceCurrency, "USD");
  const eurOnly = { eur: 430, usd: 0, uah: 0 };
  assert.equal(addRevozportUkraineShippingToPriceSet(eurOnly, "Revozport", "UA", null, managed, 49), eurOnly);
  const eurSource = { eur: 430, usd: 498.8, uah: 21285, sourceCurrency: "EUR" as const };
  assert.equal(addRevozportUkraineShippingToPriceSet(eurSource, "Revozport", "UA", null, managed, 49), eurSource);
});
