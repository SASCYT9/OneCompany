import test from 'node:test';
import assert from 'node:assert/strict';
import type { ShopProduct } from '../../../src/lib/shopCatalog';
import {
  getProductsForUrbanCollection,
  getUrbanCollectionHandleForProduct,
} from '../../../src/lib/urbanCollectionMatcher';

function buildUrbanProduct(overrides: Partial<ShopProduct>): ShopProduct {
  return {
    slug: 'urb-test',
    brand: 'Urban Automotive',
    vendor: 'Urban Automotive',
    tags: ['store:urban'],
    title: {
      ua: 'Urban product',
      en: 'Urban product',
    },
    collection: {
      ua: '',
      en: '',
    },
    collections: [],
    price: {
      eur: 0,
      usd: 0,
      uah: 0,
    },
    compareAt: {
      eur: 0,
      usd: 0,
      uah: 0,
    },
    category: {
      ua: '',
      en: '',
    },
    productType: null,
    bundle: true,
    ...overrides,
  } as ShopProduct;
}

test('routes the W463A bundle to softkit even if stale collection data says W465 Widetrack', () => {
  const product = buildUrbanProduct({
    slug: 'urb-bun-25358198-v1',
    title: {
      ua: 'Пакет заміни бамперів Urban для Mercedes-Benz G-Wagon Widetrack',
      en: 'Replacement Bumper Mercedes W463A G-Wagon Widetrack URBAN Aerokit:',
    },
    collection: {
      ua: 'Mercedes-Benz G-Class W465',
      en: 'Mercedes-Benz G-Class W465',
    },
    collections: [
      {
        handle: 'mercedes-g-wagon-w465-widetrack',
        title: {
          ua: 'Mercedes-Benz G-Class W465',
          en: 'Mercedes-Benz G-Class W465',
        },
      },
    ],
  });

  assert.equal(getUrbanCollectionHandleForProduct(product), 'mercedes-g-wagon-softkit');
});

test('excludes the W463A bundle from the W465 Widetrack collection', () => {
  const softkitProduct = buildUrbanProduct({
    slug: 'urb-bun-25358198-v1',
    title: {
      ua: 'Пакет заміни бамперів Urban для Mercedes-Benz G-Wagon Widetrack',
      en: 'Replacement Bumper Mercedes W463A G-Wagon Widetrack URBAN Aerokit:',
    },
    collection: {
      ua: 'Mercedes-Benz G-Class W465',
      en: 'Mercedes-Benz G-Class W465',
    },
    collections: [
      {
        handle: 'mercedes-g-wagon-w465-widetrack',
        title: {
          ua: 'Mercedes-Benz G-Class W465',
          en: 'Mercedes-Benz G-Class W465',
        },
      },
    ],
  });
  const widetrackProduct = buildUrbanProduct({
    slug: 'urb-bun-25358207-v1',
    title: {
      ua: 'Пакет Urban Widetrack для Mercedes-Benz G-Wagon W465',
      en: 'Replacement Bumper Mercedes W465 G-Wagon Widetrack URBAN Aerokit:',
    },
    collection: {
      ua: 'Mercedes-Benz G-Class W465',
      en: 'Mercedes-Benz G-Class W465',
    },
    collections: [
      {
        handle: 'mercedes-g-wagon-w465-widetrack',
        title: {
          ua: 'Mercedes-Benz G-Class W465',
          en: 'Mercedes-Benz G-Class W465',
        },
      },
    ],
  });

  const matches = getProductsForUrbanCollection(
    [softkitProduct, widetrackProduct],
    'mercedes-g-wagon-w465-widetrack',
    'Mercedes G-Wagon W465 Widetrack',
    'Urban Automotive'
  );

  assert.deepEqual(matches.map((product) => product.slug), ['urb-bun-25358207-v1']);
});

test('prefers the softkit collection for the W463A bundle', () => {
  const softkitProduct = buildUrbanProduct({
    slug: 'urb-bun-25358198-v1',
    title: {
      ua: 'Пакет Urban Soft Kit для Mercedes-Benz G-Wagon W463A',
      en: 'Replacement Bumper Mercedes W463A G-Wagon Widetrack URBAN Aerokit:',
    },
    collection: {
      ua: 'Mercedes-Benz G-Class W463A',
      en: 'Mercedes-Benz G-Class W463A',
    },
  });

  const matches = getProductsForUrbanCollection(
    [softkitProduct],
    'mercedes-g-wagon-softkit',
    'Mercedes G-Wagon Softkit',
    'Urban Automotive'
  );

  assert.deepEqual(matches.map((product) => product.slug), ['urb-bun-25358198-v1']);
});

test('prefers the aerokit collection when the primary collection says W465 Aerokit', () => {
  const aerokitProduct = buildUrbanProduct({
    slug: 'urb-roo-25358202-v1',
    title: {
      ua: 'Даховий світловий модуль Urban для Mercedes-Benz G-Wagon W465 Aerokit',
      en: 'Mercedes W465 G-Wagon Aerokit / Widetrack Roof Light Cluster with Urban Emblem',
    },
    collection: {
      ua: 'Mercedes G-Wagon W465 Aerokit',
      en: 'Mercedes G-Wagon W465 Aerokit',
    },
    collections: [
      {
        handle: 'mercedes-g-wagon-w465-widetrack',
        title: {
          ua: 'G-Wagon Widetrack',
          en: 'G-Wagon Widetrack',
        },
      },
      {
        handle: 'mercedes-g-wagon-w465-aerokit',
        title: {
          ua: 'G-Wagon Aerokit',
          en: 'G-Wagon Aerokit',
        },
      },
    ],
  });

  assert.equal(getUrbanCollectionHandleForProduct(aerokitProduct), 'mercedes-g-wagon-w465-aerokit');
});

test('includes shared W465 accessories in both aerokit and widetrack collections', () => {
  const sharedProduct = buildUrbanProduct({
    slug: 'urb-roo-25358202-v1',
    title: {
      ua: 'Даховий світловий модуль Urban для Mercedes-Benz G-Wagon W465 Aerokit',
      en: 'Mercedes W465 G-Wagon Aerokit / Widetrack Roof Light Cluster with Urban Emblem',
    },
    collection: {
      ua: 'Mercedes G-Wagon W465 Aerokit',
      en: 'Mercedes G-Wagon W465 Aerokit',
    },
    collections: [
      {
        handle: 'mercedes-g-wagon-w465-widetrack',
        title: {
          ua: 'G-Wagon Widetrack',
          en: 'G-Wagon Widetrack',
        },
      },
      {
        handle: 'mercedes-g-wagon-w465-aerokit',
        title: {
          ua: 'G-Wagon Aerokit',
          en: 'G-Wagon Aerokit',
        },
      },
    ],
  });

  const aerokitMatches = getProductsForUrbanCollection(
    [sharedProduct],
    'mercedes-g-wagon-w465-aerokit',
    'Mercedes G-Wagon W465 Aerokit',
    'Mercedes-Benz'
  );
  const widetrackMatches = getProductsForUrbanCollection(
    [sharedProduct],
    'mercedes-g-wagon-w465-widetrack',
    'Mercedes G-Wagon W465 Widetrack',
    'Mercedes-Benz'
  );

  assert.deepEqual(aerokitMatches.map((product) => product.slug), ['urb-roo-25358202-v1']);
  assert.deepEqual(widetrackMatches.map((product) => product.slug), ['urb-roo-25358202-v1']);
});
