import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShopViewerPricingContext,
  resolveShopPriceBands,
} from '../../../src/lib/shopPricingAudience';
import { buildShopSettingsRuntimeFromPayload } from '../../../src/lib/shopAdminSettings';

const baseSettings = buildShopSettingsRuntimeFromPayload({
  b2bVisibilityMode: 'approved_only',
  defaultB2bDiscountPercent: 10,
  defaultCurrency: 'EUR',
  enabledCurrencies: ['EUR', 'USD', 'UAH'],
  currencyRates: { EUR: 1, USD: 1.08, UAH: 45 },
  shippingZones: [],
  taxRegions: [],
  orderNotificationEmail: null,
  b2bNotes: null,
  fopCompanyName: null,
  fopIban: null,
  fopBankName: null,
  fopEdrpou: null,
  fopDetails: null,
  stripeEnabled: false,
  whiteBitEnabled: false,
});

test('approved B2B viewer gets discount-derived pricing when explicit B2B prices are absent', () => {
  const context = buildShopViewerPricingContext(baseSettings, 'B2B_APPROVED', true, 12);
  const pricing = resolveShopPriceBands({
    b2cPrice: { eur: 1000, usd: 1080, uah: 45000 },
    b2cCompareAt: { eur: 1100, usd: 1188, uah: 49500 },
    context,
  });

  assert.equal(pricing.audience, 'b2b');
  assert.equal(pricing.source, 'b2b-discount');
  assert.equal(pricing.discountPercent, 12);
  assert.deepEqual(pricing.effectivePrice, { eur: 880, usd: 950.4, uah: 39600 });
  assert.deepEqual(pricing.bands.b2b?.price, { eur: 880, usd: 950.4, uah: 39600 });
});

test('explicit B2B prices override percentage discounts for approved customers', () => {
  const context = buildShopViewerPricingContext(baseSettings, 'B2B_APPROVED', true, 20);
  const pricing = resolveShopPriceBands({
    b2cPrice: { eur: 1000, usd: 1080, uah: 45000 },
    b2bPrice: { eur: 790, usd: 860, uah: 35500 },
    context,
  });

  assert.equal(pricing.audience, 'b2b');
  assert.equal(pricing.source, 'b2b-explicit');
  assert.equal(pricing.discountPercent, null);
  assert.deepEqual(pricing.effectivePrice, { eur: 790, usd: 860, uah: 35500 });
});

test('public_dual shows B2B band to guests while checkout audience stays B2C', () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    ...baseSettings,
    b2bVisibilityMode: 'public_dual',
  });
  const context = buildShopViewerPricingContext(settings, null, false, null);
  const pricing = resolveShopPriceBands({
    b2cPrice: { eur: 500, usd: 540, uah: 22500 },
    context,
  });

  assert.equal(pricing.audience, 'b2c');
  assert.equal(pricing.b2bVisible, true);
  assert.deepEqual(pricing.bands.b2b?.price, { eur: 450, usd: 486, uah: 20250 });
});

test('request_quote hides B2B numeric band for pending users but keeps quote prompt', () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    ...baseSettings,
    b2bVisibilityMode: 'request_quote',
  });
  const context = buildShopViewerPricingContext(settings, 'B2B_PENDING', true, null);
  const pricing = resolveShopPriceBands({
    b2cPrice: { eur: 500, usd: 540, uah: 22500 },
    context,
  });

  assert.equal(pricing.audience, 'b2c');
  assert.equal(pricing.b2bVisible, false);
  assert.equal(pricing.requestQuote, true);
});
