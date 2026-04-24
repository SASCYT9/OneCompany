import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectAdroMakes,
  detectAdroModels,
  enrichAdroCatalogProduct,
  isAdroProduct,
  normalizeAdroCategory,
} from '../../../src/lib/adroCatalog';
import type { ShopProduct } from '../../../src/lib/shopCatalog';

function product(overrides: Partial<ShopProduct>): ShopProduct {
  const base: ShopProduct = {
    slug: 'adro-test',
    sku: 'A00A00-0000',
    scope: 'auto',
    brand: 'ADRO',
    vendor: '',
    productType: '',
    tags: [],
    collections: [],
    title: { en: '', ua: '' },
    category: { en: '', ua: '' },
    shortDescription: { en: '', ua: '' },
    longDescription: { en: '', ua: '' },
    leadTime: { en: '', ua: '' },
    stock: 'inStock',
    collection: { en: '', ua: '' },
    price: { eur: 0, usd: 0, uah: 0 },
    image: '',
    gallery: [],
    highlights: [],
    variants: [],
  };

  return { ...base, ...overrides };
}

test('isAdroProduct accepts ADRO brand or vendor', () => {
  assert.equal(isAdroProduct(product({ brand: 'ADRO' })), true);
  assert.equal(isAdroProduct(product({ brand: '', vendor: 'Adro' })), true);
  assert.equal(isAdroProduct(product({ brand: 'CSF', vendor: 'CSF' })), false);
});

test('detectAdroMakes supports BMW, Porsche, Tesla, Kia, Ford, and Honda fitments', () => {
  assert.deepEqual(
    detectAdroMakes(product({ title: { en: 'ADRO Carbon Lip for BMW M2 (G87)', ua: '' } })),
    ['BMW']
  );
  assert.deepEqual(
    detectAdroMakes(product({ title: { en: 'ADRO Swan Neck Wing for PORSCHE 911 GT3 (992.1)', ua: '' } })),
    ['Porsche']
  );
  assert.deepEqual(
    detectAdroMakes(product({ title: { en: 'ADRO V2 Side Skirts for TESLA Model 3', ua: '' } })),
    ['Tesla']
  );
  assert.deepEqual(
    detectAdroMakes(product({ title: { en: 'ADRO Carbon Fiber Front Lip for KIA Stinger 2018-2023', ua: '' } })),
    ['Kia']
  );
  assert.deepEqual(
    detectAdroMakes(product({ title: { en: 'ADRO Carbon Fiber Splitter for FORD Mustang 2015-2023', ua: '' } })),
    ['Ford']
  );
  assert.deepEqual(
    detectAdroMakes(product({ title: { en: 'ADRO Aero Kit for HONDA Civic Type R (FL5)', ua: '' } })),
    ['Honda']
  );
});

test('detectAdroMakes and models keep multi-fitment products in every matching make', () => {
  const source = product({
    title: {
      en: 'ADRO A18A10-2101 Facelift Style Front Bumper with Splitter for TOYOTA GR86 / SUBARU BRZ 2022- / BMW M2 (F87)',
      ua: '',
    },
  });

  assert.deepEqual(detectAdroMakes(source), ['BMW', 'Toyota', 'Subaru']);
  assert.deepEqual(detectAdroModels(source), ['GR86', 'BRZ', 'M2 (F87)']);
});

test('detectAdroModels supports Ukrainian title fitment marker', () => {
  assert.deepEqual(
    detectAdroModels(
      product({
        title: {
          en: 'ADRO A18A30-1301 Карбоновий задній дифузор для TOYOTA GR Yaris (GEN 1) 2020+',
          ua: '',
        },
      })
    ),
    ['GR Yaris (GEN 1)']
  );
});

test('normalizeAdroCategory maps feed category variants to stable facets', () => {
  assert.equal(
    normalizeAdroCategory(product({ category: { en: 'Diffusers', ua: '' } })).key,
    'diffusers'
  );
  assert.equal(
    normalizeAdroCategory(product({ category: { en: 'Пороги', ua: '' } })).key,
    'side-skirts'
  );
  assert.equal(
    normalizeAdroCategory(product({ category: { en: 'Комплекти обвісів', ua: '' } })).key,
    'body-kits'
  );
  assert.equal(
    normalizeAdroCategory(product({ category: { en: 'Капоти і аксесуари', ua: '' } })).key,
    'hoods'
  );
  assert.equal(
    normalizeAdroCategory(product({ category: { en: 'Інше', ua: 'Інше' } })).key,
    'other'
  );
});

test('unknown make and category get deterministic fallbacks', () => {
  const source = product({
    title: { en: 'ADRO Carbon Fiber Trim for UNKNOWN Track Car', ua: '' },
    category: { en: 'Special Trim', ua: '' },
  });

  assert.deepEqual(detectAdroMakes(source), ['Other']);
  assert.equal(normalizeAdroCategory(source).key, 'special-trim');
});

test('enrichAdroCatalogProduct returns searchable catalog facets', () => {
  const enriched = enrichAdroCatalogProduct(
    product({
      slug: 'adro-a15a10-1201',
      sku: 'A15A10-1201',
      title: { en: 'ADRO A15A10-1201 V1 Front Bumper Lip for TESLA Model 3', ua: '' },
      category: { en: 'Бампера, накладки на бампера та підспойлери', ua: '' },
    })
  );

  assert.deepEqual(enriched.makes, ['Tesla']);
  assert.deepEqual(enriched.models, ['Model 3']);
  assert.equal(enriched.category.key, 'front-aero');
  assert.equal(enriched.searchText.includes('a15a10-1201'), true);
});
