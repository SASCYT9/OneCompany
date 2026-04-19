import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAdminProductBulkStatusInput } from '../../../src/lib/adminRouteValidation';

test('parseAdminProductBulkStatusInput normalizes ids and archive invariants', () => {
  const parsed = parseAdminProductBulkStatusInput({
    ids: [' product-1 ', 'product-1', 'product-2'],
    status: 'ARCHIVED',
  });

  assert.deepEqual(parsed.ids, ['product-1', 'product-2']);
  assert.equal(parsed.status, 'ARCHIVED');
  assert.equal(parsed.isPublished, false);
  assert.equal(parsed.clearPublishedAt, true);
});

test('parseAdminProductBulkStatusInput rejects unknown statuses', () => {
  assert.throws(
    () =>
      parseAdminProductBulkStatusInput({
        ids: ['product-1'],
        status: 'DELETED',
      }),
    /Invalid status/i
  );
});
