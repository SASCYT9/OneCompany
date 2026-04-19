import test from 'node:test';
import assert from 'node:assert/strict';

import type { ShopProduct } from '../../../src/lib/shopCatalog';
import { getUrbanCatalogProducts } from '../../../src/lib/urbanCollectionMatcher';

function buildProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    slug: 'urban-spoiler',
    sku: 'URB-SPOILER',
    scope: 'auto',
    brand: 'Land Rover',
    vendor: 'Urban Automotive',
    productType: 'Spoilers',
    tags: ['urban-family:exterior'],
    collections: [
      {
        handle: 'land-rover-defender-110',
        title: { ua: 'Defender 110', en: 'Defender 110' },
        brand: 'Land Rover',
        isUrban: true,
        sortOrder: 1,
      },
    ],
    title: { ua: 'Urban Spoiler', en: 'Urban Spoiler' },
    category: { ua: 'Спойлери', en: 'Spoilers' },
    shortDescription: { ua: 'UA', en: 'EN' },
    longDescription: { ua: 'UA', en: 'EN' },
    leadTime: { ua: '', en: '' },
    stock: 'inStock',
    collection: { ua: 'Defender 110', en: 'Defender 110' },
    price: { eur: 1000, usd: 1100, uah: 45000 },
    image: 'https://cdn.example.com/spoiler.jpg',
    gallery: ['https://cdn.example.com/spoiler.jpg'],
    highlights: [],
    ...overrides,
  };
}

test('getUrbanCatalogProducts keeps synced Urban items when brand stores the vehicle make', () => {
  const urbanSynced = buildProduct({
    slug: 'urb-spo-25353093-v1',
    brand: 'Land Rover',
    vendor: 'Urban Automotive',
  });
  const nonUrban = buildProduct({
    slug: 'akrapovic-slip-on',
    sku: 'AKR-SLIP',
    brand: 'Akrapovic',
    vendor: 'Akrapovic',
    title: { ua: 'Akrapovic Slip-On', en: 'Akrapovic Slip-On' },
    category: { ua: 'Вихлоп', en: 'Exhaust' },
    collection: { ua: 'Signature Sound', en: 'Signature Sound' },
    collections: [],
  });

  assert.deepEqual(getUrbanCatalogProducts([urbanSynced, nonUrban]).map((product) => product.slug), [
    'urb-spo-25353093-v1',
  ]);
});

test('getUrbanCatalogProducts still supports legacy Urban brand records', () => {
  const legacyUrban = buildProduct({
    slug: 'urban-defender-widebody',
    brand: 'Urban Automotive',
    vendor: undefined,
    collections: [],
  });

  assert.deepEqual(getUrbanCatalogProducts([legacyUrban]).map((product) => product.slug), [
    'urban-defender-widebody',
  ]);
});
