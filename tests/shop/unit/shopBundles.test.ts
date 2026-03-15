import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBundleInventory } from '../../../src/lib/shopBundles';

test('bundle quantity resolves from the scarcest component', () => {
  const bundle = resolveBundleInventory([
    {
      id: 'item-1',
      quantity: 2,
      componentProduct: {
        id: 'product-1',
        slug: 'urban-front-bumper',
        scope: 'auto',
        brand: 'Urban',
        image: '/images/front.jpg',
        title: { ua: 'Передній бампер', en: 'Front bumper' },
        collection: { ua: 'Defender', en: 'Defender' },
        stock: 'inStock',
        defaultVariantInventoryQty: 7,
      },
    },
    {
      id: 'item-2',
      quantity: 1,
      componentProduct: {
        id: 'product-2',
        slug: 'urban-wheel-set',
        scope: 'auto',
        brand: 'Urban',
        image: '/images/wheels.jpg',
        title: { ua: 'Диски', en: 'Wheel set' },
        collection: { ua: 'Defender', en: 'Defender' },
        stock: 'inStock',
        defaultVariantInventoryQty: 3,
      },
    },
  ]);

  assert.equal(bundle.availableQuantity, 3);
  assert.equal(bundle.stock, 'inStock');
  assert.equal(bundle.items[0]?.availableQuantity, 3);
  assert.equal(bundle.items[1]?.availableQuantity, 3);
});

test('bundle falls back to variant inventory when component variant is selected', () => {
  const bundle = resolveBundleInventory([
    {
      id: 'item-1',
      quantity: 1,
      componentProduct: {
        id: 'product-1',
        slug: 'urban-rear-bumper',
        scope: 'auto',
        brand: 'Urban',
        image: '/images/rear.jpg',
        title: { ua: 'Задній бампер', en: 'Rear bumper' },
        collection: { ua: 'Range Rover', en: 'Range Rover' },
        stock: 'preOrder',
        defaultVariantInventoryQty: 100,
      },
      componentVariant: {
        id: 'variant-1',
        title: 'Gloss carbon',
        inventoryQty: 0,
      },
    },
  ]);

  assert.equal(bundle.availableQuantity, 0);
  assert.equal(bundle.stock, 'preOrder');
  assert.equal(bundle.items[0]?.variantTitle, 'Gloss carbon');
});
