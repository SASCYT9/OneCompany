import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildAdminProductArchiveMutation,
  parseAdminProductDeleteMode,
} from '../../../src/lib/adminRouteValidation';

test('parseAdminProductDeleteMode defaults to archive', () => {
  assert.equal(parseAdminProductDeleteMode(undefined), 'archive');
  assert.equal(parseAdminProductDeleteMode(''), 'archive');
  assert.equal(parseAdminProductDeleteMode('ARCHIVE'), 'archive');
});

test('parseAdminProductDeleteMode rejects retention-breaking hard deletes', () => {
  assert.throws(
    () => parseAdminProductDeleteMode('hard'),
    /retention-protected and can only be archived/
  );
});

test('admin product DELETE has no physical product deletion path', () => {
  const source = readFileSync(
    'src/app/api/admin/shop/products/[id]/route.ts',
    'utf8'
  );
  const deleteHandler = source.slice(source.indexOf('export async function DELETE'));
  assert.doesNotMatch(deleteHandler, /shopProduct\.delete\(/);
  assert.doesNotMatch(deleteHandler, /mode:\s*["']hard["']/);
  assert.match(deleteHandler, /coordinateShopCatalogProductMutation/);
  assert.match(deleteHandler, /changeDomains: \["VISIBILITY"\]/);
});

test('buildAdminProductArchiveMutation always disables publication', () => {
  assert.deepEqual(buildAdminProductArchiveMutation(), {
    status: 'ARCHIVED',
    isPublished: false,
    publishedAt: null,
  });
});
