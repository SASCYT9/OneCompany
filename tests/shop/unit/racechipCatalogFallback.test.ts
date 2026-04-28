import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RACECHIP_CATALOG_FALLBACK_PRODUCTS,
  RACECHIP_X6_G06_30D_MILD_HYBRID_298HP_SLUG,
  getRacechipCatalogFallbackProductBySlug,
} from '../../../src/lib/racechipCatalogFallback';

test('includes RaceChip BMW X6 G06 30 d Mild-Hybrid 298 HP fallback product', () => {
  const product = getRacechipCatalogFallbackProductBySlug(
    RACECHIP_X6_G06_30D_MILD_HYBRID_298HP_SLUG
  );

  assert.ok(product);
  assert.equal(product.brand, 'RaceChip');
  assert.equal(product.price.eur, 739);
  assert.equal(product.compareAt, undefined);
  assert.equal(product.variants?.[0]?.sku, 'RC-GTS5-BMW-30-D-MILD-HYBRID-2993CCM-298HP-219KW-650NM-AC');
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

test('includes generated missing GTS 5 products from the audit', () => {
  assert.ok(RACECHIP_CATALOG_FALLBACK_PRODUCTS.length >= 180);

  const x5Product = getRacechipCatalogFallbackProductBySlug(
    'racechip-gts5-bmw-x5-g05-from-2018-30d-mild-hybrid-2993ccm-298hp-219kw-650nm'
  );

  assert.ok(x5Product);
  assert.equal(x5Product.price.eur, 739);
  assert.equal(x5Product.title.en, 'RaceChip GTS 5 — BMW X5 G05 (2018+) 30D MILD HYBRID 2993CC');
  assert.match(x5Product.longDescription.ua, /Приріст:<\/strong> \+42 к\.с\. \/ \+54 Нм/);
});

test('keeps generated fallback slugs unique and avoids base horsepower as gain', () => {
  const slugs = RACECHIP_CATALOG_FALLBACK_PRODUCTS.map((product) => product.slug);
  assert.equal(new Set(slugs).size, slugs.length);

  const amgGtProduct = getRacechipCatalogFallbackProductBySlug(
    'racechip-gts5-mercedes-benz-amg-gt-c192-from-2023-63-amg-4-maticplus-3982ccm-585hp-430kw-800nm'
  );

  assert.ok(amgGtProduct);
  assert.match(amgGtProduct.longDescription.en, /\+60 HP \/ \+75 Nm/);
  assert.doesNotMatch(amgGtProduct.longDescription.en, /\+585 HP/);
});
