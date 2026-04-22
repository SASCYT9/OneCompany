import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeShopDisplayPrices,
  hasAnyShopPrice,
  pickShopSortableAmount,
} from '../../../src/lib/shopDisplayPrices';

test('computeShopDisplayPrices derives EUR and USD from a UAH-only base price', () => {
  const computed = computeShopDisplayPrices(
    { eur: 0, usd: 0, uah: 63388 },
    { EUR: 1, USD: 1.173401, UAH: 51.4974 }
  );

  assert.deepEqual(computed, {
    eur: 1230.9,
    usd: 1444.34,
    uah: 63388,
  });
});

test('hasAnyShopPrice returns false only when every price lane is empty', () => {
  assert.equal(hasAnyShopPrice({ eur: 0, usd: 0, uah: 0 }, { EUR: 1, USD: 2, UAH: 4 }), false);
  assert.equal(hasAnyShopPrice({ eur: 0, usd: 0, uah: 200 }, { EUR: 1, USD: 2, UAH: 4 }), true);
});

test('pickShopSortableAmount falls back to the next available computed lane', () => {
  const rates = { EUR: 1, USD: 2, UAH: 4 };

  assert.equal(pickShopSortableAmount({ eur: 0, usd: 0, uah: 200 }, 'EUR', rates), 50);
  assert.equal(pickShopSortableAmount({ eur: 0, usd: 0, uah: 200 }, 'USD', rates), 100);
  assert.equal(pickShopSortableAmount({ eur: 0, usd: 0, uah: 200 }, 'EUR', null), 200);
});
