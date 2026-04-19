import test from 'node:test';
import assert from 'node:assert/strict';
import { planVariantMutations } from '../../../src/lib/shopAdminCatalogMutations';

test('planVariantMutations preserves existing variant identity and deletes only safe omissions', () => {
  const plan = planVariantMutations(
    [
      {
        id: 'variant-kept',
        inventoryLevelCount: 2,
        cartItemCount: 0,
        bundleItemCount: 0,
        orderItemCount: 1,
      },
      {
        id: 'variant-delete',
        inventoryLevelCount: 0,
        cartItemCount: 0,
        bundleItemCount: 0,
        orderItemCount: 0,
      },
    ],
    [
      { id: 'variant-kept', sku: 'KEPT-001' },
      { sku: 'NEW-001' },
    ]
  );

  assert.deepEqual(
    plan.updateIds,
    ['variant-kept'],
  );
  assert.equal(plan.create.length, 1);
  assert.deepEqual(plan.deleteIds, ['variant-delete']);
  assert.deepEqual(plan.blockers, []);
});

test('planVariantMutations blocks deletion when omitted variants still have dependent records', () => {
  const plan = planVariantMutations(
    [
      {
        id: 'variant-blocked',
        inventoryLevelCount: 1,
        cartItemCount: 0,
        bundleItemCount: 2,
        orderItemCount: 0,
      },
    ],
    []
  );

  assert.deepEqual(plan.deleteIds, []);
  assert.equal(plan.blockers.length, 1);
  assert.equal(plan.blockers[0]?.id, 'variant-blocked');
  assert.deepEqual(plan.blockers[0]?.reasons, ['inventoryLevels', 'bundleItems']);
});
