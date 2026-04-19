import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminProductArchiveMutation,
  parseAdminProductDeleteMode,
} from '../../../src/lib/adminRouteValidation';

test('parseAdminProductDeleteMode defaults to archive', () => {
  assert.equal(parseAdminProductDeleteMode(undefined), 'archive');
  assert.equal(parseAdminProductDeleteMode(''), 'archive');
  assert.equal(parseAdminProductDeleteMode('ARCHIVE'), 'archive');
});

test('parseAdminProductDeleteMode allows explicit hard delete mode', () => {
  assert.equal(parseAdminProductDeleteMode('hard'), 'hard');
});

test('buildAdminProductArchiveMutation always disables publication', () => {
  assert.deepEqual(buildAdminProductArchiveMutation(), {
    status: 'ARCHIVED',
    isPublished: false,
    publishedAt: null,
  });
});
