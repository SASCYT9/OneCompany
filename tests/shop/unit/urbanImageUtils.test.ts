import test from 'node:test';
import assert from 'node:assert/strict';
import { isUrbanPlaceholderImage, resolveUrbanProductImage } from '../../../src/lib/urbanImageUtils';

test('treats Shopify Urban silhouette PNGs with query strings as placeholders', () => {
  const url =
    'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Gwagon_e9292903-5bf9-49aa-92da-8264c9bb9586.png?v=1776081527';

  assert.equal(isUrbanPlaceholderImage(url), true);
});

test('resolves Urban placeholder images to a collection fallback image', () => {
  const url =
    'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Gwagon_e9292903-5bf9-49aa-92da-8264c9bb9586.png?v=1776081527';

  const resolved = resolveUrbanProductImage(url, ['mercedes-g-wagon-w465-widetrack']);

  assert.equal(resolved.includes('image-coming-soon'), false);
  assert.equal(resolved.includes('Gwagon_e9292903-5bf9-49aa-92da-8264c9bb9586.png'), false);
});
