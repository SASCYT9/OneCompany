import test from 'node:test';
import assert from 'node:assert/strict';
import { countReferencedAssetUrls } from '../../../src/lib/adminAssetReferences';

test('countReferencedAssetUrls finds urls in nested objects, arrays, and HTML strings', () => {
  const counts = countReferencedAssetUrls(
    {
      hero: {
        poster: '/media/hero-poster.webp',
      },
      blog: {
        bodyHtml:
          '<p><img src="/media/hero-poster.webp" /></p><p><img src="/media/gallery-1.webp" /></p>',
        gallery: ['/media/gallery-1.webp', '/media/gallery-1.webp'],
      },
      misc: [null, 42, { image: '/media/hero-poster.webp' }],
    },
    ['/media/hero-poster.webp', '/media/gallery-1.webp']
  );

  assert.equal(counts.get('/media/hero-poster.webp'), 3);
  assert.equal(counts.get('/media/gallery-1.webp'), 3);
});
