import test from 'node:test';
import assert from 'node:assert/strict';
import type { ShopProduct } from '../../../src/lib/shopCatalog';
import { buildUrbanCatalogEntries, getUrbanProductFamily } from '../../../src/lib/urbanCatalogFacets';

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

test('getUrbanProductFamily lets explicit product type override stale bodykit tags', () => {
  assert.equal(
    getUrbanProductFamily(
      buildProduct({
        productType: 'Wheels',
        category: { ua: 'Диски', en: 'Wheels' },
        title: { ua: 'Диск Urban UC9 23" Satin Black', en: '23" UC9 - 5x130 - ET25 - Satin Black' },
        collection: { ua: 'G-Wagon Widetrack', en: 'G-Wagon Widetrack' },
        tags: ['urban-family:bodykits', 'Wheels'],
      })
    ),
    'wheels'
  );

  assert.equal(
    getUrbanProductFamily(
      buildProduct({
        productType: 'Exhaust',
        category: { ua: 'Вихлоп', en: 'Exhaust' },
        title: {
          ua: 'Вихлопна система для Bentley Continental GT',
          en: 'Bentley Continental GT Performance Exhaust System (Mandatory for the body kit)',
        },
        tags: ['urban-family:bodykits', 'Exhaust'],
      })
    ),
    'exhaust'
  );

  assert.equal(
    getUrbanProductFamily(
      buildProduct({
        productType: 'Hoods',
        category: { ua: 'Капоти', en: 'Hoods' },
        title: { ua: 'Капот Visual Carbon Fibre для G-Wagon Aerokit', en: 'G-Wagon Aerokit Vented Bonnet' },
        tags: ['urban-family:bodykits', 'Hoods'],
      })
    ),
    'exterior'
  );
});

test('buildUrbanCatalogEntries applies explicit Discovery 5 programme titles', () => {
  const entries = buildUrbanCatalogEntries({
    locale: 'ua',
    products: [
      buildProduct({
        slug: 'urb-bod-25353141-v1',
        sku: 'URB-BOD-25353141-V1',
        productType: 'Bodykits',
        category: { ua: 'Обвіси', en: 'Bodykits' },
        title: {
          ua: 'Обвіси для Land Rover Discovery 5',
          en: 'Land Rover Discovery 5 URBAN Package Facelift (2020+):',
        },
        collection: { ua: 'Discovery 5', en: 'Discovery 5' },
      }),
      buildProduct({
        slug: 'urb-bod-25353139-v1',
        sku: 'URB-BOD-25353139-V1',
        productType: 'Bodykits',
        category: { ua: 'Обвіси', en: 'Bodykits' },
        title: {
          ua: 'Аеродинамічний комплект Urban для Land Rover Discovery 5',
          en: 'Discovery 5 URBAN Discovery Bodykit (2017-2020)',
        },
        collection: { ua: 'Discovery 5', en: 'Discovery 5' },
      }),
    ],
  });

  assert.equal(
    entries[0]?.title,
    'Повний пакет Urban Facelift 2020+ для Land Rover Discovery 5'
  );
  assert.equal(
    entries[1]?.title,
    'Bodykit Urban Pre-Facelift 2017-2020 для Land Rover Discovery 5'
  );
});

test('buildUrbanCatalogEntries disambiguates Urban titles that differ only in English details', () => {
  const entries = buildUrbanCatalogEntries({
    locale: 'ua',
    products: [
      buildProduct({
        slug: 'urb-whe-26064214-v1',
        sku: 'URB-WHE-26064214-V1',
        productType: 'Wheels',
        category: { ua: 'Диски', en: 'Wheels' },
        title: {
          ua: 'Диск Urban WX2-R 23" Satin Black для Defender',
          en: 'WX2-R 23" Satin Black Front Wheel - ET35',
        },
      }),
      buildProduct({
        slug: 'urb-whe-26064215-v1',
        sku: 'URB-WHE-26064215-V1',
        productType: 'Wheels',
        category: { ua: 'Диски', en: 'Wheels' },
        title: {
          ua: 'Диск Urban WX2-R 23" Satin Black для Defender',
          en: 'WX2-R 23" Satin Black Rear Wheel - ET25',
        },
      }),
      buildProduct({
        slug: 'urb-tri-25358195-v1',
        sku: 'URB-TRI-25358195-V1',
        productType: 'Trim',
        category: { ua: 'Оздоблення', en: 'Trim' },
        title: {
          ua: 'Оздоблення Visual Carbon Fibre для Mercedes-Benz G-Wagon Softkit',
          en: 'D-Pillar Trim - Visual Carbon Fibre (Pair)',
        },
      }),
      buildProduct({
        slug: 'urb-spo-25358234-v1',
        sku: 'URB-SPO-25358234-V1',
        productType: 'Spoilers',
        category: { ua: 'Спойлери', en: 'Spoilers' },
        title: {
          ua: 'Спойлер Visual Carbon Fibre для Audi RSQ8',
          en: 'Upper Rear Lip Spoiler - Visual Carbon Fibre',
        },
      }),
      buildProduct({
        slug: 'urb-sid-25353027-v1',
        sku: 'URB-SID-25353027-V1',
        productType: 'Side Steps',
        category: { ua: 'Пороги', en: 'Side Steps' },
        title: {
          ua: 'Бічні підніжки Linear для Range Rover',
          en: 'LWB Linear Side Steps',
        },
      }),
    ],
  });

  assert.match(entries[0]?.title ?? '', /передня вісь/);
  assert.match(entries[0]?.title ?? '', /ET35/);
  assert.match(entries[1]?.title ?? '', /задня вісь/);
  assert.match(entries[1]?.title ?? '', /ET25/);
  assert.match(entries[2]?.title ?? '', /D-Pillar/);
  assert.match(entries[3]?.title ?? '', /верхній/);
  assert.match(entries[4]?.title ?? '', /LWB/);
});
