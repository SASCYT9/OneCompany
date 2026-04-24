import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('shared admin primitives expose ops detail building blocks', () => {
  const source = readRepoFile('src/components/admin/AdminPrimitives.tsx');

  for (const marker of [
    'AdminEntityToolbar',
    'AdminInspectorCard',
    'AdminKeyValueGrid',
    'AdminTimelineList',
    'AdminSplitDetailShell',
  ]) {
    assert.match(source, new RegExp(`\\b${marker}\\b`));
  }
});

test('orders and customers workbench pages use shared ops primitives', () => {
  const pageExpectations = [
    {
      path: 'src/app/admin/shop/orders/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminFilterBar', 'AdminActionBar', 'AdminTableShell', 'OrderInlineWorkbench'],
    },
    {
      path: 'src/app/admin/shop/orders/[id]/page.tsx',
      markers: ['AdminPageHeader', 'AdminEntityToolbar', 'AdminSplitDetailShell', 'AdminInspectorCard', 'AdminTimelineList'],
    },
    {
      path: 'src/app/admin/shop/orders/create/page.tsx',
      markers: ['AdminEditorShell', 'AdminEditorSection', 'AdminActionBar'],
    },
    {
      path: 'src/app/admin/shop/customers/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminFilterBar', 'AdminTableShell'],
    },
    {
      path: 'src/app/admin/shop/customers/[id]/page.tsx',
      markers: ['AdminPageHeader', 'AdminEntityToolbar', 'AdminSplitDetailShell', 'AdminInspectorCard', 'AdminTimelineList'],
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

test('import operations screens use shared admin primitives including job detail route', () => {
  const pageExpectations = [
    {
      path: 'src/app/admin/shop/import/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminActionBar', 'AdminEditorSection', 'AdminTableShell'],
    },
    {
      path: 'src/app/admin/shop/import/jobs/[id]/page.tsx',
      markers: ['AdminPageHeader', 'AdminSplitDetailShell', 'AdminInspectorCard', 'AdminKeyValueGrid', 'AdminTimelineList'],
    },
    {
      path: 'src/app/admin/shop/turn14/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminActionBar', 'AdminFilterBar', 'AdminTableShell'],
    },
    {
      path: 'src/app/admin/shop/turn14/markups/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminActionBar', 'AdminFilterBar', 'AdminTableShell'],
    },
    {
      path: 'src/app/admin/shop/quality/page.tsx',
      markers: ['Catalog Quality Center', 'AdminMetricGrid', 'AdminFilterBar', 'AdminInspectorCard', 'AdminTableShell'],
    },
    {
      path: 'src/app/admin/shop/feed/page.tsx',
      markers: ['AdminPageHeader', 'AdminMetricGrid', 'AdminFilterBar', 'AdminInspectorCard', 'AdminTableShell'],
    },
    {
      path: 'src/app/admin/shop/audit/page.tsx',
      markers: ['AdminPageHeader', 'AdminFilterBar', 'AdminTableShell'],
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
