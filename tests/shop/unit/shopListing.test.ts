import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeaturedBrandComparator,
  buildShopListingResult,
  normalizeShopListingQuery,
  type ShopListingQueryState,
} from '../../../src/lib/shopListing';
import type { ShopProduct } from '../../../src/lib/shopCatalog';

const PRODUCTS: ShopProduct[] = [
  {
    slug: 'kw-v4',
    sku: 'KW-1',
    scope: 'auto',
    brand: 'KW Suspension',
    title: { ua: 'KW V4', en: 'KW V4' },
    category: { ua: 'Підвіска', en: 'Suspension' },
    shortDescription: { ua: 'Трекова підвіска', en: 'Track suspension' },
    longDescription: { ua: 'Детальний опис', en: 'Detailed description' },
    leadTime: { ua: '7 днів', en: '7 days' },
    stock: 'inStock',
    collection: { ua: 'Street x Track', en: 'Street x Track' },
    price: { eur: 1000, usd: 1100, uah: 45000 },
    image: '/img/kw.jpg',
    highlights: [],
    createdAt: '2026-03-19T10:00:00.000Z',
    updatedAt: '2026-03-19T10:00:00.000Z',
    categoryNode: { id: 'cat-1', slug: 'suspension', title: { ua: 'Підвіска', en: 'Suspension' } },
    collections: [{ handle: 'range-rover-l460', title: { ua: 'Range Rover L460', en: 'Range Rover L460' } }],
  },
  {
    slug: 'fi-system',
    sku: 'FI-1',
    scope: 'auto',
    brand: 'FI Exhaust',
    title: { ua: 'FI System', en: 'FI System' },
    category: { ua: 'Вихлоп', en: 'Exhaust' },
    shortDescription: { ua: 'Вихлопна система', en: 'Exhaust system' },
    longDescription: { ua: 'Глибокий тон', en: 'Deep tone' },
    leadTime: { ua: '10 днів', en: '10 days' },
    stock: 'preOrder',
    collection: { ua: 'Signature Sound', en: 'Signature Sound' },
    price: { eur: 2500, usd: 2750, uah: 110000 },
    image: '/img/fi.jpg',
    highlights: [],
    createdAt: '2026-03-21T09:00:00.000Z',
    updatedAt: '2026-03-21T09:00:00.000Z',
    categoryNode: { id: 'cat-2', slug: 'exhaust', title: { ua: 'Вихлоп', en: 'Exhaust' } },
    collections: [{ handle: 'range-rover-l460', title: { ua: 'Range Rover L460', en: 'Range Rover L460' } }],
  },
  {
    slug: 'eventuri-intake',
    sku: 'EV-1',
    scope: 'auto',
    brand: 'Eventuri',
    title: { ua: 'Eventuri Intake', en: 'Eventuri Intake' },
    category: { ua: 'Впуск', en: 'Intake' },
    shortDescription: { ua: 'Карбоновий впуск', en: 'Carbon intake' },
    longDescription: { ua: 'Airflow upgrade', en: 'Airflow upgrade' },
    leadTime: { ua: '5 днів', en: '5 days' },
    stock: 'inStock',
    collection: { ua: 'Carbon Airflow', en: 'Carbon Airflow' },
    price: { eur: 1800, usd: 1980, uah: 81000 },
    image: '/img/eventuri.jpg',
    highlights: [],
    updatedAt: '2026-03-20T08:00:00.000Z',
    categoryNode: { id: 'cat-3', slug: 'intake', title: { ua: 'Впуск', en: 'Intake' } },
    collections: [{ handle: 'defender-110', title: { ua: 'Defender 110', en: 'Defender 110' } }],
  },
];

function buildResult(query: Partial<ShopListingQueryState>) {
  return buildShopListingResult(PRODUCTS, {
    locale: 'en',
    currency: 'EUR',
    rates: null,
    query: {
      q: '',
      sort: 'featured',
      brand: 'all',
      category: 'all',
      priceMin: null,
      priceMax: null,
      availability: 'all',
      store: '',
      collection: '',
      ...query,
    },
    featuredComparator: buildFeaturedBrandComparator(),
  });
}

test('normalizeShopListingQuery validates modes and swaps min/max', () => {
  const query = normalizeShopListingQuery(
    new URLSearchParams('sort=broken&availability=wrong&priceMin=2500&priceMax=500&q=  carbon  ')
  );

  assert.equal(query.sort, 'featured');
  assert.equal(query.availability, 'all');
  assert.equal(query.q, 'carbon');
  assert.equal(query.priceMin, 500);
  assert.equal(query.priceMax, 2500);
});

test('buildShopListingResult sorts by price low and high', () => {
  const lowToHigh = buildResult({ sort: 'priceLow' }).products.map((product) => product.slug);
  const highToLow = buildResult({ sort: 'priceHigh' }).products.map((product) => product.slug);

  assert.deepEqual(lowToHigh, ['kw-v4', 'eventuri-intake', 'fi-system']);
  assert.deepEqual(highToLow, ['fi-system', 'eventuri-intake', 'kw-v4']);
});

test('buildShopListingResult sorts newest by createdAt with updatedAt fallback', () => {
  const result = buildResult({ sort: 'newest' }).products.map((product) => product.slug);
  assert.deepEqual(result, ['fi-system', 'eventuri-intake', 'kw-v4']);
});

test('buildShopListingResult filters by availability', () => {
  const result = buildResult({ availability: 'inStock' }).products.map((product) => product.slug);
  assert.deepEqual(result, ['kw-v4', 'eventuri-intake']);
});

test('buildShopListingResult filters by price range', () => {
  const result = buildResult({ priceMin: 1200, priceMax: 2000 }).products.map((product) => product.slug);
  assert.deepEqual(result, ['eventuri-intake']);
});

test('buildShopListingResult combines brand, category, price and availability filters', () => {
  const result = buildResult({
    brand: 'Eventuri',
    category: 'intake',
    priceMin: 1500,
    priceMax: 1900,
    availability: 'inStock',
    q: 'carbon',
  });

  assert.equal(result.total, 1);
  assert.equal(result.products[0]?.slug, 'eventuri-intake');
});
