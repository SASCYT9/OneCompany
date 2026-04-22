import test from 'node:test';
import assert from 'node:assert/strict';

import { detectOhlinsCategory, detectOhlinsMake } from '../../../src/lib/ohlinsCatalog';

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
      slug: 'ohlins-05926-10',
      title: { en: 'OHLINS 05926-10 Rear Shock Mount Set BMW M3 E46', ua: 'OHLINS 05926-10 Rear Shock Mount Set BMW M3 E46' },
      shortDescription: { en: '', ua: '' },
    }),
    { label: 'Mounts & Hardware', labelUa: 'Опори та кріплення' }
  );

  assert.deepEqual(
    detectOhlinsCategory({
      slug: 'ohlins-gttx25',
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
      slug: 'ohlins-25608-01',
      title: { en: 'OHLINS 25608-01 Rubber Bushing 16/37/37', ua: 'OHLINS 25608-01 Rubber Bushing 16/37/37' },
      shortDescription: { en: '', ua: '' },
    }),
    { label: 'Mounts & Hardware', labelUa: 'Опори та кріплення' }
  );
});
