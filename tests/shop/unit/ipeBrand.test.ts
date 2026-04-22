import test from 'node:test';
import assert from 'node:assert/strict';

import { isIpeBrandValue, isIpeProduct } from '../../../src/lib/ipeBrand';

test('isIpeBrandValue recognizes current catalog aliases', () => {
  assert.equal(isIpeBrandValue('iPE'), true);
  assert.equal(isIpeBrandValue('iPE exhaust'), true);
  assert.equal(isIpeBrandValue('Innotech Performance Exhaust'), true);
  assert.equal(isIpeBrandValue('Akrapovic'), false);
});

test('isIpeProduct matches brand, vendor, and tag aliases', () => {
  assert.equal(
    isIpeProduct({
      brand: 'iPE exhaust',
      vendor: null,
      tags: [],
    }),
    true
  );

  assert.equal(
    isIpeProduct({
      brand: 'Premium Exhaust',
      vendor: 'Innotech Performance Exhaust',
      tags: [],
    }),
    true
  );

  assert.equal(
    isIpeProduct({
      brand: 'Premium Exhaust',
      vendor: null,
      tags: ['iPE'],
    }),
    true
  );

  assert.equal(
    isIpeProduct({
      brand: 'Akrapovic',
      vendor: null,
      tags: ['Titanium'],
    }),
    false
  );
});
