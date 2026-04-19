import test from 'node:test';
import assert from 'node:assert/strict';
import type { ShopProduct } from '../../../src/lib/shopCatalog';
import { buildUrbanCatalogEntries } from '../../../src/lib/urbanCatalogFacets';

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
        handle: 'land-rover-defender-90',
        title: { ua: 'Defender 90', en: 'Defender 90' },
        brand: 'Land Rover',
        isUrban: true,
        sortOrder: 1,
      },
      {
        handle: 'land-rover-defender-110',
        title: { ua: 'Defender 110', en: 'Defender 110' },
        brand: 'Land Rover',
        isUrban: true,
        sortOrder: 2,
      },
    ],
    title: { ua: 'Urban Spoiler', en: 'Urban Spoiler' },
    category: { ua: 'Спойлери', en: 'Spoilers' },
    shortDescription: { ua: 'UA', en: 'EN' },
    longDescription: { ua: 'UA', en: 'EN' },
    leadTime: { ua: '', en: '' },
    stock: 'inStock',
    collection: { ua: 'Defender 90 / Defender 110', en: 'Defender 90 / Defender 110' },
    price: { eur: 1000, usd: 1100, uah: 45000 },
    image: 'https://cdn.example.com/spoiler.jpg',
    gallery: ['https://cdn.example.com/spoiler.jpg'],
    highlights: [],
    ...overrides,
  };
}

test('buildUrbanCatalogEntries uses all Urban collection links for model filtering', () => {
  const entries = buildUrbanCatalogEntries({
    locale: 'en',
    products: [buildProduct()],
  });

  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0]?.modelHandles, [
    'land-rover-defender-90',
    'land-rover-defender-110',
  ]);
  assert.equal(entries[0]?.brand, 'Land Rover');
  assert.equal(entries[0]?.family, 'exterior');
  assert.equal(entries[0]?.categoryLabel, 'Spoilers');
});

test('buildUrbanCatalogEntries falls back to legacy regex when structured family tag is absent', () => {
  const entries = buildUrbanCatalogEntries({
    locale: 'en',
    products: [
      buildProduct({
        tags: [],
        productType: 'Wheels',
        category: { ua: 'Диски', en: 'Wheels' },
        title: { ua: 'L663 Wheel', en: 'L663 Wheel' },
      }),
    ],
  });

  assert.equal(entries[0]?.family, 'wheels');
});
