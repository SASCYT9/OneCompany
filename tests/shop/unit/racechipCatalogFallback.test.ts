import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RACECHIP_X6_G06_30D_MILD_HYBRID_298HP_SLUG,
  getRacechipCatalogFallbackProductBySlug,
} from '../../../src/lib/racechipCatalogFallback';

test('includes RaceChip BMW X6 G06 30 d Mild-Hybrid 298 HP fallback product', () => {
  const product = getRacechipCatalogFallbackProductBySlug(
    RACECHIP_X6_G06_30D_MILD_HYBRID_298HP_SLUG
  );

  assert.ok(product);
  assert.equal(product.brand, 'RaceChip');
  assert.equal(product.price.eur, 549);
  assert.equal(product.compareAt?.eur, 739);
  assert.deepEqual(
    product.tags?.filter((tag) => tag.startsWith('car_') || tag.startsWith('base_hp:')),
    [
      'car_make:bmw',
      'car_model:x6-g06-from-2019',
      'car_engine:30-d-mild-hybrid-2993ccm-298hp-219kw-650nm',
      'base_hp:298',
    ]
  );
  assert.match(product.longDescription.en, /298 HP \(219 kW\) \/ 650 Nm/);
  assert.match(product.longDescription.en, /\+42 HP \/ \+54 Nm/);
});
