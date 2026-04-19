import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('crm dashboard uses the shared admin dashboard/list primitives', () => {
  const source = readRepoFile('src/app/admin/crm/page.tsx');

  assert.match(source, /from ['"]@\/components\/admin\/AdminPrimitives['"]/);
  assert.match(source, /\bAdminPageHeader\b/);
  assert.match(source, /\bAdminMetricGrid\b/);
  assert.match(source, /\bAdminActionBar\b/);
  assert.match(source, /\bAdminTableShell\b/);
});

test('crm detail screens use the shared admin detail primitives', () => {
  const pageExpectations = [
    {
      path: 'src/app/admin/crm/customers/[id]/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminTableShell'],
    },
    {
      path: 'src/app/admin/crm/orders/[id]/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminTableShell'],
    },
  ];

  for (const expectation of pageExpectations) {
    const source = readRepoFile(expectation.path);
    assert.match(source, /from ['"]@\/components\/admin\/AdminPrimitives['"]/);
    for (const marker of expectation.markers) {
      assert.match(source, new RegExp(`\\b${marker}\\b`));
    }
  }
});
