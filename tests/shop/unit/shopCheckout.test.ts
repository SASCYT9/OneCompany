import test from "node:test";
import assert from "node:assert/strict";
import { buildShopSettingsRuntimeFromPayload } from "../../../src/lib/shopAdminSettings";
import { buildCheckoutSettingsPreview } from "../../../src/lib/shopCheckout";
import { EU_VAT_COUNTRIES } from "../../../src/lib/shopEuVat";

test("checkout settings preview applies shipping zones, tax regions and totals", () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    b2bVisibilityMode: "approved_only",
    defaultB2bDiscountPercent: null,
    defaultCurrency: "EUR",
    enabledCurrencies: ["EUR", "USD", "UAH"],
    currencyRates: { EUR: 1, USD: 1.152174, UAH: 53 },
    shippingZones: [
      {
        id: "de-standard",
        name: "Germany",
        countries: ["Germany", "DE"],
        regions: [],
        baseRate: 50,
        perItemRate: 10,
        freeOver: null,
        minimumSubtotal: null,
        currency: "EUR",
        enabled: true,
      },
    ],
    taxRegions: [
      {
        id: "de-vat",
        name: "Germany VAT",
        countries: ["Germany", "DE"],
        regions: [],
        rate: 0.19,
        appliesToShipping: true,
        enabled: true,
      },
    ],
    orderNotificationEmail: null,
    b2bNotes: null,
  } as any);

  const quote = buildCheckoutSettingsPreview(settings, {
    currency: "EUR",
    subtotal: 1000,
    itemCount: 2,
    shippingAddress: {
      line1: "Alexanderplatz 1",
      city: "Berlin",
      country: "Germany",
    },
  });

  assert.equal(quote.currency, "EUR");
  assert.equal(quote.subtotal, 1000);
  assert.equal(quote.shippingCost, 70);
  assert.equal(quote.taxAmount, 203.3);
  assert.equal(quote.total, 1273.3);
  assert.equal(quote.shippingZone?.id, "de-standard");
  assert.equal(quote.taxRegion?.id, "de-vat");
  assert.equal((quote.pricingSnapshot as { audience: string }).audience, "b2c");
});

test("checkout settings preview applies admin-configured EU VAT by destination country", () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    b2bVisibilityMode: "approved_only",
    defaultB2bDiscountPercent: null,
    defaultCurrency: "EUR",
    enabledCurrencies: ["EUR", "USD", "UAH"],
    currencyRates: { EUR: 1, USD: 1.152174, UAH: 53 },
    shippingZones: [
      {
        id: "free-test",
        name: "Free test",
        countries: ["*"],
        regions: [],
        calcMode: "flat",
        baseRate: 0,
        perItemRate: 0,
        ratePerKg: 0,
        volSurchargePerKg: 0,
        volumetricDivisor: 5000,
        fallbackWeightKg: 0,
        fallbackLength: 0,
        fallbackWidth: 0,
        fallbackHeight: 0,
        freeOver: null,
        minimumSubtotal: null,
        currency: "EUR",
        enabled: true,
        etaMinDays: null,
        etaMaxDays: null,
      },
    ],
    taxRegions: EU_VAT_COUNTRIES.map((country) => ({
      id: `eu-vat-${country.code.toLowerCase()}`,
      name: `${country.name} VAT`,
      countries: [country.code, country.name, ...(country.aliases ?? [])],
      regions: [],
      rate: country.standardRate,
      appliesToShipping: true,
      enabled: true,
    })),
    orderNotificationEmail: null,
    b2bNotes: null,
  } as any);

  const totals = [
    ["Germany", "eu-vat-de", 190],
    ["Poland", "eu-vat-pl", 230],
    ["Finland", "eu-vat-fi", 255],
    ["Hungary", "eu-vat-hu", 270],
    ["Switzerland", null, 0],
  ] as const;

  for (const [country, expectedRegionId, expectedTax] of totals) {
    const quote = buildCheckoutSettingsPreview(settings, {
      currency: "EUR",
      subtotal: 1000,
      itemCount: 1,
      shippingAddress: {
        line1: "Test",
        city: "Test",
        country,
      },
    });

    assert.equal(quote.taxRegion?.id ?? null, expectedRegionId);
    assert.equal(quote.taxAmount, expectedTax);
    assert.equal(quote.total, 1000 + expectedTax);
  }
});

test("checkout settings preview does not apply VAT when admin tax rules are empty", () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    b2bVisibilityMode: "approved_only",
    defaultB2bDiscountPercent: null,
    defaultCurrency: "EUR",
    enabledCurrencies: ["EUR", "USD", "UAH"],
    currencyRates: { EUR: 1, USD: 1.152174, UAH: 53 },
    shippingZones: [
      {
        id: "free-test",
        name: "Free test",
        countries: ["*"],
        regions: [],
        calcMode: "flat",
        baseRate: 0,
        perItemRate: 0,
        ratePerKg: 0,
        volSurchargePerKg: 0,
        volumetricDivisor: 5000,
        fallbackWeightKg: 0,
        fallbackLength: 0,
        fallbackWidth: 0,
        fallbackHeight: 0,
        freeOver: null,
        minimumSubtotal: null,
        currency: "EUR",
        enabled: true,
        etaMinDays: null,
        etaMaxDays: null,
      },
    ],
    taxRegions: [],
    orderNotificationEmail: null,
    b2bNotes: null,
  } as any);

  const quote = buildCheckoutSettingsPreview(settings, {
    currency: "EUR",
    subtotal: 1000,
    itemCount: 1,
    shippingAddress: {
      line1: "Test",
      city: "Berlin",
      country: "Germany",
    },
  });

  assert.equal(quote.taxRegion, null);
  assert.equal(quote.taxAmount, 0);
  assert.equal(quote.total, 1000);
});

test("checkout VAT only applies to Europe net priced items", () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    b2bVisibilityMode: "approved_only",
    defaultB2bDiscountPercent: null,
    defaultCurrency: "EUR",
    enabledCurrencies: ["EUR", "USD", "UAH"],
    currencyRates: { EUR: 1, USD: 1.152174, UAH: 53 },
    shippingZones: [
      {
        id: "de-flat",
        name: "Germany flat",
        countries: ["Germany", "DE"],
        regions: [],
        calcMode: "flat",
        baseRate: 80,
        perItemRate: 10,
        ratePerKg: 0,
        volSurchargePerKg: 0,
        volumetricDivisor: 5000,
        fallbackWeightKg: 0,
        fallbackLength: 0,
        fallbackWidth: 0,
        fallbackHeight: 0,
        freeOver: null,
        minimumSubtotal: null,
        currency: "EUR",
        enabled: true,
        etaMinDays: null,
        etaMaxDays: null,
      },
    ],
    taxRegions: [
      {
        id: "de-vat",
        name: "Germany VAT",
        countries: ["Germany", "DE"],
        regions: [],
        rate: 0.19,
        appliesToShipping: true,
        enabled: true,
      },
    ],
    orderNotificationEmail: null,
    b2bNotes: null,
  } as any);

  const quote = buildCheckoutSettingsPreview(settings, {
    currency: "EUR",
    subtotal: 1000,
    itemCount: 2,
    items: [
      { total: 600, quantity: 1, pricingBaseRegion: "europe" },
      { total: 400, quantity: 1, pricingBaseRegion: "default" },
    ],
    shippingAddress: {
      line1: "Test",
      city: "Berlin",
      country: "Germany",
    },
  });

  assert.equal(quote.subtotal, 1000);
  assert.equal(quote.shippingCost, 100);
  assert.equal(quote.taxableSubtotal, 600);
  assert.equal(quote.taxableShippingCost, 60);
  assert.equal(quote.taxAmount, 125.4);
  assert.equal(quote.total, 1225.4);
});

test("checkout VAT is zero for EU destination when cart uses only default prices", () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    b2bVisibilityMode: "approved_only",
    defaultB2bDiscountPercent: null,
    defaultCurrency: "EUR",
    enabledCurrencies: ["EUR", "USD", "UAH"],
    currencyRates: { EUR: 1, USD: 1.152174, UAH: 53 },
    shippingZones: [
      {
        id: "de-flat",
        name: "Germany flat",
        countries: ["Germany", "DE"],
        regions: [],
        calcMode: "flat",
        baseRate: 80,
        perItemRate: 10,
        ratePerKg: 0,
        volSurchargePerKg: 0,
        volumetricDivisor: 5000,
        fallbackWeightKg: 0,
        fallbackLength: 0,
        fallbackWidth: 0,
        fallbackHeight: 0,
        freeOver: null,
        minimumSubtotal: null,
        currency: "EUR",
        enabled: true,
        etaMinDays: null,
        etaMaxDays: null,
      },
    ],
    taxRegions: [
      {
        id: "de-vat",
        name: "Germany VAT",
        countries: ["Germany", "DE"],
        regions: [],
        rate: 0.19,
        appliesToShipping: true,
        enabled: true,
      },
    ],
    orderNotificationEmail: null,
    b2bNotes: null,
  } as any);

  const quote = buildCheckoutSettingsPreview(settings, {
    currency: "EUR",
    subtotal: 1000,
    itemCount: 2,
    items: [
      { total: 700, quantity: 1, pricingBaseRegion: "default" },
      { total: 300, quantity: 1, pricingBaseRegion: "default" },
    ],
    shippingAddress: {
      line1: "Test",
      city: "Berlin",
      country: "Germany",
    },
  });

  assert.equal(quote.subtotal, 1000);
  assert.equal(quote.shippingCost, 100);
  assert.equal(quote.taxableSubtotal, 0);
  assert.equal(quote.taxableShippingCost, 0);
  assert.equal(quote.taxRegion?.id, "de-vat");
  assert.equal(quote.taxAmount, 0);
  assert.equal(quote.total, 1100);
});
