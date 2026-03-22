import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShopSettingsRuntimeFromPayload } from '../../../src/lib/shopAdminSettings';
import { buildCheckoutSettingsPreview } from '../../../src/lib/shopCheckout';

test('checkout settings preview applies shipping zones, tax regions and totals', () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    b2bVisibilityMode: 'approved_only',
    defaultB2bDiscountPercent: null,
    defaultCurrency: 'EUR',
    enabledCurrencies: ['EUR', 'USD', 'UAH'],
    currencyRates: { EUR: 1, USD: 1.08, UAH: 45 },
    shippingZones: [
      {
        id: 'de-standard',
        name: 'Germany',
        countries: ['Germany', 'DE'],
        regions: [],
        baseRate: 50,
        perItemRate: 10,
        freeOver: null,
        minimumSubtotal: null,
        currency: 'EUR',
        enabled: true,
      },
    ],
    taxRegions: [
      {
        id: 'de-vat',
        name: 'Germany VAT',
        countries: ['Germany', 'DE'],
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
    currency: 'EUR',
    subtotal: 1000,
    itemCount: 2,
    shippingAddress: {
      line1: 'Alexanderplatz 1',
      city: 'Berlin',
      country: 'Germany',
    },
  });

  assert.equal(quote.currency, 'EUR');
  assert.equal(quote.subtotal, 1000);
  assert.equal(quote.shippingCost, 70);
  assert.equal(quote.taxAmount, 203.3);
  assert.equal(quote.total, 1273.3);
  assert.equal(quote.shippingZone?.id, 'de-standard');
  assert.equal(quote.taxRegion?.id, 'de-vat');
  assert.equal((quote.pricingSnapshot as { audience: string }).audience, 'b2c');
});
