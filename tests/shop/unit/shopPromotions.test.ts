import assert from 'node:assert/strict';
import test from 'node:test';
import { CustomerGroup, ShopPromotionType } from '@prisma/client';
import { buildShopSettingsRuntimeFromPayload } from '../../../src/lib/shopAdminSettings';
import { evaluateShopPromotion } from '../../../src/lib/shopPromotions';

const settings = buildShopSettingsRuntimeFromPayload({
  b2bVisibilityMode: 'approved_only',
  defaultB2bDiscountPercent: null,
  defaultCurrency: 'EUR',
  enabledCurrencies: ['EUR', 'USD', 'UAH'],
  currencyRates: { EUR: 1, USD: 1.1, UAH: 45 },
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

function createPromotion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    storeKey: 'urban',
    code: 'URBAN10',
    titleUa: 'Весняна акція',
    titleEn: 'Spring promo',
    descriptionUa: 'Знижка 10%',
    descriptionEn: '10% off',
    promotionType: ShopPromotionType.PERCENTAGE,
    discountValue: 10,
    currency: 'EUR',
    minimumSubtotal: null,
    usageLimit: null,
    usageCount: 0,
    customerGroup: null,
    appliesToAll: true,
    productSlugs: [],
    categorySlugs: [],
    brandNames: [],
    startsAt: null,
    endsAt: null,
    isActive: true,
    createdAt: new Date('2026-03-21T10:00:00.000Z'),
    updatedAt: new Date('2026-03-21T10:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock(promotion: Record<string, unknown> | null) {
  return {
    shopPromotion: {
      findFirst: async () => promotion,
    },
  } as any;
}

test('evaluateShopPromotion applies percentage promo to subtotal', async () => {
  const result = await evaluateShopPromotion(createPrismaMock(createPromotion()), {
    storeKey: 'urban',
    promoCode: 'URBAN10',
    currency: 'EUR',
    locale: 'en',
    customerGroup: CustomerGroup.B2C,
    settings,
    subtotal: 1000,
    shippingCost: 90,
    items: [{ productSlug: 'test-product', brand: 'Urban', categorySlug: 'bodykits', total: 1000 }],
  });

  assert.equal(result.discountAmount, 100);
  assert.equal(result.discountedSubtotal, 900);
  assert.equal(result.discountedShippingCost, 90);
  assert.equal(result.promotion?.code, 'URBAN10');
});

test('evaluateShopPromotion applies free shipping promo', async () => {
  const result = await evaluateShopPromotion(
    createPrismaMock(
      createPromotion({
        code: 'SHIPFREE',
        promotionType: ShopPromotionType.FREE_SHIPPING,
        discountValue: null,
      })
    ),
    {
      storeKey: 'urban',
      promoCode: 'SHIPFREE',
      currency: 'EUR',
      locale: 'en',
      customerGroup: CustomerGroup.B2C,
      settings,
      subtotal: 1000,
      shippingCost: 90,
      items: [{ productSlug: 'test-product', brand: 'Urban', categorySlug: 'bodykits', total: 1000 }],
    }
  );

  assert.equal(result.discountAmount, 90);
  assert.equal(result.discountedSubtotal, 1000);
  assert.equal(result.discountedShippingCost, 0);
});

test('evaluateShopPromotion rejects subtotal below minimum', async () => {
  await assert.rejects(
    () =>
      evaluateShopPromotion(
        createPrismaMock(
          createPromotion({
            minimumSubtotal: 1500,
          })
        ),
        {
          storeKey: 'urban',
          promoCode: 'URBAN10',
          currency: 'EUR',
          locale: 'en',
          customerGroup: CustomerGroup.B2C,
          settings,
          subtotal: 1000,
          shippingCost: 90,
          items: [{ productSlug: 'test-product', brand: 'Urban', categorySlug: 'bodykits', total: 1000 }],
        }
      ),
    /PROMOTION_MINIMUM_NOT_MET/
  );
});
