import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductsFromShopifyCsv } from '../../../src/lib/shopAdminCsv';

const SOURCE_CSV = [
  [
    'Model Handle',
    'Model Title',
    'Body (HTML)',
    'Vendor',
    'Type',
    'Tags',
    'Published',
    'Option1 Name',
    'Option1 Value',
    'Variant SKU',
    'Variant Grams',
    'Variant Inventory Qty',
    'Variant Inventory Policy',
    'Variant Fulfillment Service',
    'Variant Price',
    'Variant Compare At Price',
    'Image Src',
  ].join(','),
  [
    'urban-range-rover-kit',
    'Urban Range Rover Kit',
    '"<p>Full carbon body kit</p>"',
    'Urban Automotive',
    'Body Kit',
    '"urban,range-rover"',
    'TRUE',
    'Finish',
    'Gloss',
    'URB-RR-001',
    '0',
    '4',
    'deny',
    'manual',
    '45000',
    '47000',
    'https://cdn.example.com/range-rover.jpg',
  ].join(','),
].join('\n');

test('CSV builder supports template-driven header remapping', () => {
  const result = buildProductsFromShopifyCsv(SOURCE_CSV, {
    'Model Handle': 'Handle',
    'Model Title': 'Title',
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.products.length, 1);
  assert.equal(result.productRows[0]?.rowNumber, 2);
  assert.equal(result.products[0]?.slug, 'urban-range-rover-kit');
  assert.equal(result.products[0]?.titleEn, 'Urban Range Rover Kit');
  assert.equal(result.products[0]?.variants[0]?.inventoryPolicy, 'DENY');
});
