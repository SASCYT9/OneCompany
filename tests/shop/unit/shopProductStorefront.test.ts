import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStorefrontBackfillPlan, extractStorefrontTag } from '../../../src/lib/shopProductStorefront';

test('buildStorefrontBackfillPlan assigns exactly one store tag and is idempotent', () => {
  const source = [
    {
      id: 'urban-1',
      slug: 'urb-spo-1',
      brand: 'Land Rover',
      vendor: 'Urban Automotive',
      tags: ['spoiler'],
      collections: [],
    },
    {
      id: 'brabus-1',
      slug: 'brabus-464-999-444',
      brand: 'Brabus',
      vendor: 'Brabus',
      tags: ['store:urban', 'g-class'],
      collections: [],
    },
    {
      id: 'main-1',
      slug: 'akr-slip-on',
      brand: 'Akrapovic',
      vendor: 'Akrapovic',
      tags: ['exhaust'],
      collections: [],
    },
  ];

  const firstPass = buildStorefrontBackfillPlan(source);

  assert.equal(firstPass.updatedCount, 3);
  assert.deepEqual(firstPass.storefrontCounts, {
    main: 1,
    urban: 1,
    brabus: 1,
  });
  assert.deepEqual(
    firstPass.items.map((item) => [item.id, item.storefront, extractStorefrontTag(item.tags)]),
    [
      ['urban-1', 'urban', 'urban'],
      ['brabus-1', 'brabus', 'brabus'],
      ['main-1', 'main', 'main'],
    ]
  );
  assert.equal(firstPass.items.every((item) => item.tags.filter((tag) => tag.startsWith('store:')).length === 1), true);

  const secondPass = buildStorefrontBackfillPlan(
    source.map((item) => ({
      ...item,
      tags: firstPass.items.find((entry) => entry.id === item.id)?.tags ?? item.tags,
    }))
  );

  assert.equal(secondPass.updatedCount, 0);
  assert.equal(secondPass.items.every((item) => item.changed === false), true);
});
