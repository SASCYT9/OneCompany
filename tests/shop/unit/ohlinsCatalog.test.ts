import test from 'node:test';
import assert from 'node:assert/strict';

import { detectOhlinsCategory, detectOhlinsMake } from '../../../src/lib/ohlinsCatalog';
import { resolveFeedManagedCatalogImage } from '../../../src/lib/shopCatalogServer';

test('detectOhlinsMake maps the corrected Isuzu prefix', () => {
  assert.equal(
    detectOhlinsMake({
      slug: 'ohlins-isv-dmax-road-track',
      title: { en: 'OHLINS Road & Track Kit', ua: 'OHLINS Road & Track Kit' },
    }),
    'Isuzu'
  );
});

test('detectOhlinsMake falls back to Universal for hardware-only items', () => {
  assert.equal(
    detectOhlinsMake({
      slug: 'ohlins-10216-02',
      title: { en: 'OHLINS 10216-02 Dust Boot R & T Car', ua: 'OHLINS 10216-02 Dust Boot R & T Car' },
    }),
    'Universal'
  );

  assert.equal(
    detectOhlinsMake({
      slug: 'ohlins-35020-16',
      title: { en: 'OHLINS 35020-16 Electronic Damping Kit Chevrolet Camaro', ua: 'OHLINS 35020-16 Electronic Damping Kit Chevrolet Camaro' },
    }),
    'Chevrolet'
  );
});

test('detectOhlinsCategory classifies mounts and motorsport catalog items', () => {
  assert.deepEqual(
    detectOhlinsCategory({
      title: { en: 'OHLINS 05926-10 Rear Shock Mount Set BMW M3 E46', ua: 'OHLINS 05926-10 Rear Shock Mount Set BMW M3 E46' },
      shortDescription: { en: '', ua: '' },
    }),
    { label: 'Mounts & Hardware', labelUa: 'Опори та кріплення' }
  );

  assert.deepEqual(
    detectOhlinsCategory({
      title: {
        en: 'OHLINS GTTX25 Motorsport Suspension Damper Formula Student Damper TTX 25 MkII 267/90',
        ua: 'OHLINS GTTX25 Motorsport Suspension Damper Formula Student Damper TTX 25 MkII 267/90',
      },
      shortDescription: { en: '', ua: '' },
    }),
    { label: 'Motorsport', labelUa: 'Motorsport' }
  );

  assert.deepEqual(
    detectOhlinsCategory({
      title: { en: 'OHLINS 25608-01 Rubber Bushing 16/37/37', ua: 'OHLINS 25608-01 Rubber Bushing 16/37/37' },
      shortDescription: { en: '', ua: '' },
    }),
    { label: 'Mounts & Hardware', labelUa: 'Опори та кріплення' }
  );

  // Specific line wins over generic "coilover/койловер" Road & Track catch-all.
  assert.deepEqual(
    detectOhlinsCategory({
      title: {
        en: 'Advanced Trackday TTX coilover kit (incl. springs and top mounts) for BMW M3 (G80) / M4 (G82)',
        ua: 'Комплект койловерів Advanced Trackday TTX (включаючи пружини та верхні опори) для BMW M3 (G80) / M4 (G82)',
      },
      shortDescription: { en: '', ua: '' },
    }),
    { label: 'Advanced Trackday', labelUa: 'Advanced Trackday' }
  );
});

test('resolveFeedManagedCatalogImage replaces stale Brabus cache images for Ohlins', () => {
  assert.equal(
    resolveFeedManagedCatalogImage('/images/shop/brabus/hq/brabus-portal-hero.png', 'OHLINS'),
    '/images/shop/ohlins/catalog-fallback.jpg'
  );

  assert.equal(
    resolveFeedManagedCatalogImage('/images/shop/ohlins/catalog-fallback.jpg', 'OHLINS'),
    '/images/shop/ohlins/catalog-fallback.jpg'
  );

  assert.equal(
    resolveFeedManagedCatalogImage(
      'https://d3pd3d30e33rxi.cloudfront.net/_default_upload_bucket/ohlins-pov-my00-1.jpg',
      'OHLINS'
    ),
    'https://d3pd3d30e33rxi.cloudfront.net/_default_upload_bucket/ohlins-pov-my00-1.jpg'
  );
});
