import test from 'node:test';
import assert from 'node:assert/strict';

import { localizeShopProductTitle } from '../../../src/lib/shopText';

test('normalizes the Akrapovic G63 tailpipe set model year suffix', () => {
  const product = {
    slug: 'akrapovic-tp-t-s-24-1',
    brand: 'AKRAPOVIC',
    vendor: undefined,
    title: {
      ua: 'AKRAPOVIC TP-T/S/24/1 Комплект наконечників вихлопних труб (титан) для MERCEDES-BENZ AMG G63 (W465 / W463A) 2018+',
      en: 'AKRAPOVIC TP-T/S/24/1 Titanium Tailpipe Set for MERCEDES-BENZ AMG G63 (W465 / W463A) 2018+',
    },
  };

  assert.equal(
    localizeShopProductTitle('ua', product),
    'AKRAPOVIC TP-T/S/24/1 Комплект наконечників вихлопних труб (титан) для MERCEDES-BENZ AMG G63 (W465 / W463A) 2025-'
  );
  assert.equal(
    localizeShopProductTitle('en', product),
    'AKRAPOVIC TP-T/S/24/1 Titanium Tailpipe Set for MERCEDES-BENZ AMG G63 (W465 / W463A) 2025-'
  );
});
