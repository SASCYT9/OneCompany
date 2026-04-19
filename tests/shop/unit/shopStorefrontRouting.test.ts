import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShopStorefrontProductPath, resolveShopStorefrontSegment } from '../../../src/lib/shopStorefrontRouting';

test('resolveShopStorefrontSegment prioritizes explicit Urban and Brabus store tags', () => {
  assert.equal(resolveShopStorefrontSegment({ slug: 'urb-part', tags: ['store:urban'] }), 'urban');
  assert.equal(resolveShopStorefrontSegment({ slug: 'brabus-part', tags: ['store:brabus'] }), 'brabus');
});

test('resolveShopStorefrontSegment keeps store:main products out of Urban and Brabus storefronts', () => {
  assert.equal(
    resolveShopStorefrontSegment({
      slug: 'urb-part',
      brand: 'Urban Automotive',
      vendor: 'Urban Automotive',
      tags: ['store:main'],
    }),
    null
  );
  assert.equal(
    buildShopStorefrontProductPath('ua', {
      slug: 'urb-part',
      brand: 'Urban Automotive',
      vendor: 'Urban Automotive',
      tags: ['store:main'],
    }),
    '/ua/shop/urb-part'
  );
});

test('buildShopStorefrontProductPath still supports legacy brand storefront routing when no store tag exists', () => {
  assert.equal(
    buildShopStorefrontProductPath('ua', {
      slug: 'akr-slip-on',
      brand: 'Akrapovic',
    }),
    '/ua/shop/akrapovic/products/akr-slip-on'
  );
});
