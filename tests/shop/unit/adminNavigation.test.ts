import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_NAV_SECTIONS,
  getActiveAdminNavItem,
  getActiveAdminNavSection,
  isAdminNavItemActive,
} from '../../../src/lib/admin/adminNavigation';

test('admin IA keeps the planned top-level section order', () => {
  assert.deepEqual(
    ADMIN_NAV_SECTIONS.map((section) => section.key),
    ['overview', 'orders', 'customers', 'catalog', 'imports', 'logistics', 'content', 'system']
  );
});

test('catalog section keeps the phase-1 commerce modules together', () => {
  const catalogSection = ADMIN_NAV_SECTIONS.find((section) => section.key === 'catalog');
  assert.ok(catalogSection);
  assert.deepEqual(
    catalogSection.items.map((item) => item.href),
    [
      '/admin/shop',
      '/admin/shop/inventory',
      '/admin/shop/categories',
      '/admin/shop/collections',
      '/admin/shop/bundles',
      '/admin/shop/media',
      '/admin/shop/quality',
      '/admin/shop/pricing',
      '/admin/shop/seo',
    ]
  );
});

test('imports section exposes feed exports beside import tooling', () => {
  const importsSection = ADMIN_NAV_SECTIONS.find((section) => section.key === 'imports');
  assert.ok(importsSection);
  assert.deepEqual(
    importsSection.items.map((item) => item.href),
    [
      '/admin/shop/import',
      '/admin/shop/stock',
      '/admin/shop/feed',
      '/admin/shop/turn14',
      '/admin/shop/audit',
    ]
  );
});

test('active matching keeps exact routes strict and nested routes grouped correctly', () => {
  const catalogRoot = ADMIN_NAV_SECTIONS
    .find((section) => section.key === 'catalog')
    ?.items.find((item) => item.href === '/admin/shop');

  const logisticsRoot = ADMIN_NAV_SECTIONS
    .find((section) => section.key === 'logistics')
    ?.items.find((item) => item.href === '/admin/shop/logistics');

  assert.ok(catalogRoot);
  assert.ok(logisticsRoot);

  assert.equal(isAdminNavItemActive('/admin/shop', catalogRoot), true);
  assert.equal(isAdminNavItemActive('/admin/shop/123', catalogRoot), false);
  assert.equal(isAdminNavItemActive('/admin/shop/logistics/taxes', logisticsRoot), false);
});

test('active item and section lookup resolves nested catalog and logistics routes', () => {
  assert.equal(getActiveAdminNavItem('/admin/shop/collections/123')?.label, 'Collections');
  assert.equal(getActiveAdminNavSection('/admin/shop/collections/123')?.label, 'Catalog');
  assert.equal(getActiveAdminNavItem('/admin/shop/quality')?.label, 'Quality center');
  assert.equal(getActiveAdminNavSection('/admin/shop/quality')?.label, 'Catalog');
  assert.equal(getActiveAdminNavItem('/admin/shop/feed')?.label, 'Feed exports');
  assert.equal(getActiveAdminNavSection('/admin/shop/feed')?.label, 'Imports & Integrations');
  assert.equal(getActiveAdminNavItem('/admin/shop/logistics/taxes')?.label, 'Regional taxes');
  assert.equal(getActiveAdminNavSection('/admin/shop/logistics/taxes')?.label, 'Logistics');
});
