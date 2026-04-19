import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUrbanGpPortalPriceSet,
  crawlGpPortalCollectionProducts,
  extractGpPortalProductHandles,
  isGpPortalPlaceholderImage,
  prepareUrbanGpPortalProducts,
  usdImportFloorToEur,
  type GpPortalProduct,
} from '../../../src/lib/urbanGpPortalSync';

const CURRENCY_RATES = {
  EUR: 1,
  USD: 1.1,
  UAH: 45,
} as const;

test('extractGpPortalProductHandles deduplicates direct and collection product links', () => {
  const html = `
    <a href="/collections/automotive/products/urb-spo-25353093-v1?_pos=1&_ss=c">Spoiler</a>
    <a href="/products/urb-spo-25353093-v1?_pos=1&_ss=c">Spoiler direct</a>
    <a href="/products/urb-ven-25353092-v1">Side vent</a>
    <a href="/collections/automotive/products/urb-ven-25353092-v1">Side vent dup</a>
  `;

  assert.deepEqual(extractGpPortalProductHandles(html), [
    'urb-spo-25353093-v1',
    'urb-ven-25353092-v1',
  ]);
});

test('isGpPortalPlaceholderImage detects known placeholders and accepts real images', () => {
  assert.equal(isGpPortalPlaceholderImage(null), true);
  assert.equal(isGpPortalPlaceholderImage('https://cdn.example.com/images/image-coming-soon.jpg'), true);
  assert.equal(isGpPortalPlaceholderImage('https://cdn.example.com/images/placeholder.png'), true);
  assert.equal(
    isGpPortalPlaceholderImage('https://cdn.shopify.com/s/files/real-product.jpg?v=1'),
    false
  );
});

test('buildUrbanGpPortalPriceSet applies markup, whole-number rounding, and cross-currency prices', () => {
  assert.deepEqual(buildUrbanGpPortalPriceSet(975, CURRENCY_RATES), {
    eur: 1170,
    usd: 1287,
    uah: 52650,
  });
});

test('usdImportFloorToEur converts the USD threshold to source EUR', () => {
  assert.equal(usdImportFloorToEur(200, CURRENCY_RATES), 181.82);
});

test('prepareUrbanGpPortalProducts skips items under the USD-equivalent threshold', () => {
  const products: GpPortalProduct[] = [
    {
      id: 1,
      handle: 'urb-bolt-1',
      title: 'Wheel Bolt Set',
      vendor: 'Urban',
      description: '<p>Accessory</p>',
      price: 18000,
      compare_at_price: null,
      featured_image: null,
      images: [],
      tags: ['Accessories'],
      product_type: 'Accessories',
      options: [],
      variants: [],
    },
  ];

  const prepared = prepareUrbanGpPortalProducts(products, {
    currencyRates: CURRENCY_RATES,
  });

  assert.equal(prepared.importableItems.length, 0);
  assert.equal(prepared.skippedItems.length, 1);
  assert.match(prepared.skippedItems[0]?.reason ?? '', /below import threshold/i);
});

test('prepareUrbanGpPortalProducts uses collection hero fallback image and multi-collection mapping', () => {
  const products: GpPortalProduct[] = [
    {
      id: 2,
      handle: 'urb-spo-25353093-v1',
      title: 'Defender L663 90/110/130/OCTA URBAN Rear Spoiler',
      vendor: 'Urban',
      description: '<p>Rear spoiler in visual carbon.</p>',
      price: 97500,
      compare_at_price: 100000,
      featured_image: null,
      images: [],
      tags: ['Defender', 'L663'],
      product_type: 'Spoilers',
      options: ['Title'],
      variants: [
        {
          id: 2001,
          title: 'Default Title',
          sku: 'URB-SPO-25353093-V1',
          price: 97500,
          compare_at_price: 100000,
          inventory_quantity: 3,
          inventory_policy: 'deny',
          requires_shipping: true,
          taxable: true,
          featured_image: null,
          option1: 'Default Title',
        },
      ],
    },
  ];

  const prepared = prepareUrbanGpPortalProducts(products, {
    currencyRates: CURRENCY_RATES,
  });

  assert.equal(prepared.blockers.length, 0);
  assert.equal(prepared.importableItems.length, 1);

  const item = prepared.importableItems[0];
  assert.deepEqual(item.collectionHandles, [
    'land-rover-defender-90',
    'land-rover-defender-110',
    'land-rover-defender-130',
    'land-rover-defender-110-octa',
  ]);
  assert.equal(item.primaryModelHandle, 'land-rover-defender-90');
  assert.equal(item.brand, 'Land Rover');
  assert.equal(item.vendor, 'Urban Automotive');
  assert.equal(item.manufacturer, 'Urban Automotive');
  assert.equal(item.family, 'exterior');
  assert.equal(item.exactCategory, 'Spoilers');
  assert.deepEqual(item.sourceTags, ['Defender', 'L663']);
  assert.equal(
    item.image,
    '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-3-2560.webp'
  );
  assert.deepEqual(item.gallery, [item.image]);
  assert.equal(item.priceEur, 1170);
  assert.equal(item.compareAtEur, 1200);
});

test('prepareUrbanGpPortalProducts hides unmatched high-value products instead of blocking the sync', () => {
  const products: GpPortalProduct[] = [
    {
      id: 3,
      handle: 'urb-mystery-1',
      title: 'Urban Mystery Hypercar Aero Package',
      vendor: 'Urban',
      description: '<p>Unmapped model.</p>',
      price: 500000,
      compare_at_price: null,
      featured_image: 'https://cdn.shopify.com/s/files/mystery.jpg?v=1',
      images: ['https://cdn.shopify.com/s/files/mystery.jpg?v=1'],
      tags: ['Hypercar'],
      product_type: 'Bodykits',
      options: [],
      variants: [],
    },
  ];

  const prepared = prepareUrbanGpPortalProducts(products, {
    currencyRates: CURRENCY_RATES,
  });

  assert.equal(prepared.importableItems.length, 0);
  assert.equal(prepared.blockers.length, 0);
  assert.equal(prepared.skippedItems.length, 1);
  assert.match(prepared.skippedItems[0]?.reason ?? '', /hidden.*no urban collection match/i);
});

test('prepareUrbanGpPortalProducts maps generic L663 wheel fitment to Defender collections', () => {
  const products: GpPortalProduct[] = [
    {
      id: 4,
      handle: 'urb-whe-26009309-v1',
      title: '22" WX2-R - 5x120 - ET25 - Satin Black - Rear (L663)',
      vendor: 'Urban',
      description: '<p>Wheel for L663 platform.</p>',
      price: 500000,
      compare_at_price: null,
      featured_image: 'https://cdn.shopify.com/s/files/wheel.jpg?v=1',
      images: ['https://cdn.shopify.com/s/files/wheel.jpg?v=1'],
      tags: ['Wheel', 'L663'],
      product_type: 'Wheels',
      options: [],
      variants: [],
    },
  ];

  const prepared = prepareUrbanGpPortalProducts(products, {
    currencyRates: CURRENCY_RATES,
  });

  assert.equal(prepared.blockers.length, 0);
  assert.deepEqual(prepared.importableItems[0]?.collectionHandles, [
    'land-rover-defender-90',
    'land-rover-defender-110',
    'land-rover-defender-130',
  ]);
  assert.equal(prepared.importableItems[0]?.brand, 'Land Rover');
  assert.equal(prepared.importableItems[0]?.family, 'wheels');
  assert.equal(prepared.importableItems[0]?.exactCategory, 'Wheels');
});

test('prepareUrbanGpPortalProducts maps generic non-classic Defender accessories to current Defender models', () => {
  const products: GpPortalProduct[] = [
    {
      id: 6,
      handle: 'urb-key-26033105-v1',
      title: 'Leather Defender Key Fob',
      vendor: 'Urban',
      description: '<p>Leather key fob for Defender.</p>',
      price: 25000,
      compare_at_price: null,
      featured_image: 'https://cdn.shopify.com/s/files/defender-key.jpg?v=1',
      images: ['https://cdn.shopify.com/s/files/defender-key.jpg?v=1'],
      tags: ['Defender'],
      product_type: 'Accessories',
      options: [],
      variants: [],
    },
  ];

  const prepared = prepareUrbanGpPortalProducts(products, {
    currencyRates: CURRENCY_RATES,
  });

  assert.equal(prepared.blockers.length, 0);
  assert.deepEqual(prepared.importableItems[0]?.collectionHandles, [
    'land-rover-defender-90',
    'land-rover-defender-110',
    'land-rover-defender-130',
  ]);
});

test('prepareUrbanGpPortalProducts reports exact categories without UA mapping', () => {
  const products: GpPortalProduct[] = [
    {
      id: 5,
      handle: 'urb-odd-1',
      title: 'Range Rover L461 Urban Matrix Hyper Vent',
      vendor: 'Urban',
      description: '<p>Odd category.</p>',
      price: 300000,
      compare_at_price: null,
      featured_image: 'https://cdn.shopify.com/s/files/hyper-vent.jpg?v=1',
      images: ['https://cdn.shopify.com/s/files/hyper-vent.jpg?v=1'],
      tags: ['L461'],
      product_type: 'Hyper Vent',
      options: [],
      variants: [],
    },
  ];

  const prepared = prepareUrbanGpPortalProducts(products, {
    currencyRates: CURRENCY_RATES,
  });

  assert.equal(prepared.importableItems.length, 1);
  assert.deepEqual(prepared.unmappedCategories, ['Hyper Vent']);
});

test('crawlGpPortalCollectionProducts paginates, deduplicates, and validates only Urban vendor products', async () => {
  const htmlPage1 = `
    <a href="/products/urb-a">A</a>
    <a href="/collections/automotive/products/other-b">B</a>
  `;
  const htmlPage2 = `
    <a href="/products/urb-a">A</a>
    <a href="/products/urb-c">C</a>
  `;
  const htmlPage3 = `<a href="/products/urb-c">C</a>`;
  const htmlPage4 = `<div>No new handles</div>`;

  const responses = new Map<string, Response>([
    ['https://gp-portal.eu/collections/automotive?filter.p.vendor=Urban&sort_by=best-selling&page=1', new Response(htmlPage1, { status: 200 })],
    ['https://gp-portal.eu/collections/automotive?filter.p.vendor=Urban&sort_by=best-selling&page=2', new Response(htmlPage2, { status: 200 })],
    ['https://gp-portal.eu/collections/automotive?filter.p.vendor=Urban&sort_by=best-selling&page=3', new Response(htmlPage3, { status: 200 })],
    ['https://gp-portal.eu/collections/automotive?filter.p.vendor=Urban&sort_by=best-selling&page=4', new Response(htmlPage4, { status: 200 })],
    ['https://gp-portal.eu/products/urb-a.js', new Response(JSON.stringify({ handle: 'urb-a', title: 'Urban A', vendor: 'Urban', price: 25000 }), { status: 200 })],
    ['https://gp-portal.eu/products/other-b.js', new Response(JSON.stringify({ handle: 'other-b', title: 'Other B', vendor: 'Other', price: 25000 }), { status: 200 })],
    ['https://gp-portal.eu/products/urb-c.js', new Response(JSON.stringify({ handle: 'urb-c', title: 'Urban C', vendor: 'Urban', price: 25000 }), { status: 200 })],
  ]);

  const calls: string[] = [];
  const result = await crawlGpPortalCollectionProducts({
    collectionUrl: 'https://gp-portal.eu/collections/automotive?filter.p.vendor=Urban&sort_by=best-selling',
    baseUrl: 'https://gp-portal.eu',
    maxPages: 10,
    stopAfterStalePages: 2,
    fetchImpl: async (url) => {
      calls.push(url);
      const response = responses.get(url);
      if (!response) throw new Error(`Unexpected URL ${url}`);
      return response.clone();
    },
  });

  assert.equal(result.pagesCrawled, 4);
  assert.equal(result.candidateHandles, 3);
  assert.equal(result.validatedUrbanProducts, 2);
  assert.equal(result.products.length, 2);
  assert.deepEqual(result.products.map((item) => item.handle), ['urb-a', 'urb-c']);
  assert.equal(calls.includes('https://gp-portal.eu/products/other-b.js'), true);
});

test('crawlGpPortalCollectionProducts retries 429/5xx and reports retry count', async () => {
  let pageAttempts = 0;
  let productAttempts = 0;

  const result = await crawlGpPortalCollectionProducts({
    collectionUrl: 'https://gp-portal.eu/collections/automotive?filter.p.vendor=Urban&sort_by=best-selling',
    baseUrl: 'https://gp-portal.eu',
    maxPages: 3,
    stopAfterStalePages: 2,
    fetchImpl: async (url) => {
      if (url.endsWith('page=1')) {
        pageAttempts += 1;
        if (pageAttempts === 1) {
          return new Response('busy', { status: 429 });
        }
        return new Response('<a href="/products/urb-a">A</a>', { status: 200 });
      }

      if (url.endsWith('page=2')) {
        return new Response('<div>same</div>', { status: 200 });
      }

      if (url.endsWith('page=3')) {
        return new Response('<div>same</div>', { status: 200 });
      }

      if (url.endsWith('/products/urb-a.js')) {
        productAttempts += 1;
        if (productAttempts === 1) {
          return new Response('oops', { status: 500 });
        }
        return new Response(JSON.stringify({ handle: 'urb-a', title: 'Urban A', vendor: 'Urban', price: 25000 }), {
          status: 200,
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(result.retryCount, 2);
  assert.equal(result.products.length, 1);
});
