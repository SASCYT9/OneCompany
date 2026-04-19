import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('admin layout delegates navigation and chrome to a shared shell component', () => {
  const layoutSource = readRepoFile('src/app/admin/layout.tsx');

  assert.match(layoutSource, /from ['"]@\/components\/admin\/AdminShell['"]/);
  assert.doesNotMatch(layoutSource, /const NAV_GROUPS\s*:/);
  assert.doesNotMatch(layoutSource, /function SidebarGroup\s*\(/);
  assert.doesNotMatch(layoutSource, /function SidebarItem\s*\(/);
});

test('catalog list screens use the shared Phase 1 list-screen primitives', () => {
  const listPagePaths = [
    'src/app/admin/shop/page.tsx',
    'src/app/admin/shop/categories/page.tsx',
    'src/app/admin/shop/collections/page.tsx',
  ];

  for (const pagePath of listPagePaths) {
    const source = readRepoFile(pagePath);
    assert.match(source, /from ['"]@\/components\/admin\/AdminPrimitives['"]/);
    assert.match(source, /\bAdminPageHeader\b/);
    assert.match(source, /\bAdminMetricGrid\b/);
    assert.match(source, /\bAdminFilterBar\b/);
    assert.match(source, /\bAdminTableShell\b/);
  }
});

test('product editor declares explicit section navigation for the shared editor shell', () => {
  const editorSource = readRepoFile('src/app/admin/shop/components/AdminProductEditor.tsx');

  assert.match(editorSource, /\bADMIN_PRODUCT_EDITOR_SECTIONS\b/);
  assert.match(editorSource, /\bAdminEditorShell\b/);
  assert.match(editorSource, /\bAdminEditorSection\b/);
});
