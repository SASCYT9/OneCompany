import test from 'node:test';
import assert from 'node:assert/strict';

import type { ShopProduct } from '../../../src/lib/shopCatalog';
import type { ShopViewerPricingContext } from '../../../src/lib/shopPricingAudience';
import { sortUrbanCollectionProducts } from '../../../src/lib/urbanCollectionMatcher';

function buildProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    slug: 'urban-part',
    sku: 'URB-PART',
    scope: 'auto',
    brand: 'Mercedes-Benz',
    vendor: 'Urban Automotive',
    productType: 'Exterior',
    tags: [],
    collections: [
      {
        handle: 'mercedes-g-wagon-w465-widetrack',
        title: { ua: 'G-Wagon Widetrack', en: 'G-Wagon Widetrack' },
        brand: 'Mercedes-Benz',
        isUrban: true,
        sortOrder: 1,
      },
    ],
    title: { ua: 'Urban Part', en: 'Urban Part' },
    category: { ua: 'Екстерʼєр', en: 'Exterior' },
    shortDescription: { ua: 'UA', en: 'EN' },
    longDescription: { ua: 'UA', en: 'EN' },
    leadTime: { ua: '', en: '' },
    stock: 'inStock',
    collection: { ua: 'G-Wagon Widetrack', en: 'G-Wagon Widetrack' },
    price: { eur: 1000, usd: 1100, uah: 45000 },
    b2bPrice: undefined,
    compareAt: undefined,
    b2bCompareAt: undefined,
    image: 'https://cdn.example.com/product.jpg',
    gallery: ['https://cdn.example.com/product.jpg'],
    highlights: [],
    ...overrides,
  };
}

test('sortUrbanCollectionProducts keeps full kits ahead of accessories even when kits cost less', () => {
  const accessory = buildProduct({
    slug: 'urb-exh-1',
    title: {
      ua: 'Насадки вихлопу Satin Black для Mercedes-Benz G-Wagon Widetrack',
      en: 'Satin Black Exhaust Tips for Mercedes-Benz G-Wagon Widetrack',
    },
    productType: 'Exhaust Tips',
    category: { ua: 'Вихлоп', en: 'Exhaust' },
    price: { eur: 402, usd: 430, uah: 18000 },
  });
  const kit = buildProduct({
    slug: 'urb-bun-1',
    title: {
      ua: 'Пакет заміни бамперів Urban для Mercedes-Benz G-Wagon Widetrack',
      en: 'Urban Bumper Replacement Package for Mercedes-Benz G-Wagon Widetrack',
    },
    productType: 'Body Kit',
    category: { ua: 'Обвіси', en: 'Body Kits' },
    price: { eur: 350, usd: 375, uah: 16000 },
  });

  assert.deepEqual(sortUrbanCollectionProducts([accessory, kit]).map((product) => product.slug), [
    'urb-bun-1',
    'urb-exh-1',
  ]);
});

test('sortUrbanCollectionProducts uses effective viewer pricing for descending order', () => {
  const lowerB2B = buildProduct({
    slug: 'urb-a',
    title: { ua: 'Urban Mirror Caps', en: 'Urban Mirror Caps' },
    price: { eur: 1200, usd: 1290, uah: 54000 },
    b2bPrice: { eur: 600, usd: 645, uah: 27000 },
  });
  const higherB2B = buildProduct({
    slug: 'urb-b',
    title: { ua: 'Urban Rear Spoiler', en: 'Urban Rear Spoiler' },
    price: { eur: 1000, usd: 1075, uah: 45000 },
    b2bPrice: { eur: 800, usd: 860, uah: 36000 },
  });

  const viewerContext: ShopViewerPricingContext = {
    customerGroup: 'B2B_APPROVED',
    customerB2BDiscountPercent: null,
    defaultB2BDiscountPercent: 0,
    b2bVisibilityMode: 'public_dual',
    isAuthenticated: true,
  };

  assert.deepEqual(
    sortUrbanCollectionProducts([lowerB2B, higherB2B], viewerContext).map((product) => product.slug),
    ['urb-b', 'urb-a']
  );
});
