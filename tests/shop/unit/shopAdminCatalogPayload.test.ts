import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdminProductPayload } from '../../../src/lib/shopAdminCatalog';

test('normalizeAdminProductPayload keeps nested ids and dimension fields', () => {
  const { data, errors } = normalizeAdminProductPayload({
    slug: 'test-product',
    titleEn: 'Test product',
    status: 'ACTIVE',
    isPublished: true,
    weight: 12.5,
    length: 120,
    width: 45,
    height: 33,
    isDimensionsEstimated: true,
    media: [{ id: 'media-1', src: '/media/test.jpg', altText: 'Main image', mediaType: 'IMAGE' }],
    options: [{ id: 'option-1', name: 'Size', values: ['M', 'L'] }],
    variants: [
      {
        id: 'variant-1',
        title: 'Default',
        sku: 'SKU-001',
        weight: 7.5,
        length: 44,
        width: 22,
        height: 11,
        isDimensionsEstimated: true,
        isDefault: true,
      },
    ],
    metafields: [{ id: 'meta-1', namespace: 'custom', key: 'material', value: 'carbon' }],
  });

  assert.deepEqual(errors, []);
  assert.equal(data.weight, 12.5);
  assert.equal(data.length, 120);
  assert.equal(data.width, 45);
  assert.equal(data.height, 33);
  assert.equal(data.isDimensionsEstimated, true);
  assert.equal(data.media[0]?.id, 'media-1');
  assert.equal(data.options[0]?.id, 'option-1');
  assert.equal(data.variants[0]?.id, 'variant-1');
  assert.equal(data.variants[0]?.weight, 7.5);
  assert.equal(data.variants[0]?.length, 44);
  assert.equal(data.variants[0]?.width, 22);
  assert.equal(data.variants[0]?.height, 11);
  assert.equal(data.variants[0]?.isDimensionsEstimated, true);
  assert.equal(data.metafields[0]?.id, 'meta-1');
});

test('normalizeAdminProductPayload disables publish state for non-active products', () => {
  const { data } = normalizeAdminProductPayload({
    slug: 'draft-product',
    titleEn: 'Draft product',
    status: 'DRAFT',
    isPublished: true,
    publishedAt: '2026-04-19T09:30:00.000Z',
  });

  assert.equal(data.status, 'DRAFT');
  assert.equal(data.isPublished, false);
  assert.equal(data.publishedAt, null);
});
