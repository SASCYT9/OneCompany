import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavSections,
  getFirstAllowedAdminRoute,
  getActiveAdminNavItem,
  getActiveAdminNavSection,
  getAdminBreadcrumbs,
  isAdminNavItemActive,
} from "../../../src/lib/admin/adminNavigation";

test("admin IA keeps the planned top-level section order", () => {
  assert.deepEqual(
    ADMIN_NAV_SECTIONS.map((section) => section.key),
    ["overview", "work", "orders", "customers", "catalog", "logistics", "marketing", "system"]
  );
});

// The 2026-10 shell redesign grouped pages by who uses them: sales, catalog,
// warehouse/logistics, marketing. Every page from the old IA must still be reachable.
test("task-based groups keep every page from the previous navigation", () => {
  const hrefsOf = (key: string) =>
    ADMIN_NAV_SECTIONS.find((section) => section.key === key)?.items.map((item) => item.href);

  assert.deepEqual(hrefsOf("orders"), [
    "/admin/shop/orders",
    "/admin/shop/drafts",
    "/admin/messages",
    "/admin/shop/returns",
  ]);
  assert.deepEqual(hrefsOf("catalog"), [
    "/admin/shop",
    "/admin/shop/pricing",
    "/admin/shop/import",
    "/admin/shop/quality",
    "/admin/shop/categories",
    "/admin/shop/category-groups",
    "/admin/shop/collections",
    "/admin/shop/bundles",
    "/admin/shop/wheelforce-wheelsets",
    "/admin/shop/catalogs",
  ]);
  assert.deepEqual(hrefsOf("logistics"), [
    "/admin/shop/inventory",
    "/admin/shop/logistics",
    "/admin/shop/logistics/brand-rules",
    "/admin/shop/logistics/taxes",
    "/admin/shop/logistics/landed-cost",
    "/admin/shop/logistics/shipping-lab",
  ]);
  assert.deepEqual(hrefsOf("marketing"), [
    "/admin/shop/discounts",
    "/admin/marketing/email-rules",
    "/admin/blog",
  ]);

  const hrefs = ADMIN_NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.href));
  assert.equal(new Set(hrefs).size, hrefs.length, "no page is listed twice");
  // 37 before Operations «Проекты» and «Согласования» were hidden (2026-10-13).
  assert.equal(hrefs.length, 35);
});

test("every section has an icon for the collapsed sidebar rail", () => {
  for (const section of ADMIN_NAV_SECTIONS) {
    assert.ok(section.icon, `${section.key} needs an icon`);
  }
});

test("active matching keeps exact routes strict and nested routes grouped correctly", () => {
  const catalogRoot = ADMIN_NAV_SECTIONS.find((section) => section.key === "catalog")?.items.find(
    (item) => item.href === "/admin/shop"
  );

  const logisticsRoot = ADMIN_NAV_SECTIONS.find(
    (section) => section.key === "logistics"
  )?.items.find((item) => item.href === "/admin/shop/logistics");

  assert.ok(catalogRoot);
  assert.ok(logisticsRoot);

  assert.equal(isAdminNavItemActive("/admin/shop", catalogRoot), true);
  assert.equal(isAdminNavItemActive("/admin/shop/123", catalogRoot), false);
  assert.equal(isAdminNavItemActive("/admin/shop/logistics/taxes", logisticsRoot), false);
});

test("active item and section lookup resolves nested catalog and logistics routes", () => {
  assert.equal(
    getActiveAdminNavItem("/admin/shop/collections/123")?.href,
    "/admin/shop/collections"
  );
  assert.equal(getActiveAdminNavSection("/admin/shop/collections/123")?.key, "catalog");
  assert.equal(getActiveAdminNavItem("/admin/shop/quality")?.href, "/admin/shop/quality");
  assert.equal(getActiveAdminNavSection("/admin/shop/quality")?.key, "catalog");
  assert.equal(getActiveAdminNavItem("/admin/shop/import")?.href, "/admin/shop/import");
  assert.equal(getActiveAdminNavSection("/admin/shop/import")?.key, "catalog");
  assert.equal(getActiveAdminNavSection("/admin/shop/inventory")?.key, "logistics");
  assert.equal(getActiveAdminNavSection("/admin/shop/returns/abc")?.key, "orders");
  assert.equal(
    getActiveAdminNavItem("/admin/shop/logistics/taxes")?.href,
    "/admin/shop/logistics/taxes"
  );
  assert.equal(getActiveAdminNavSection("/admin/shop/logistics/taxes")?.key, "logistics");
});

test("permission-aware navigation composes task and catalog access without leaking system pages", () => {
  const permissions = [
    "ops.tasks.read",
    "ops.tasks.write",
    "ops.knowledge.read",
    "shop.products.read",
    "shop.products.write",
  ];
  const sections = filterAdminNavSections(permissions);
  const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));

  assert.equal(hrefs.includes("/admin/operations/tasks"), true);
  assert.equal(hrefs.includes("/admin/operations/knowledge"), true);
  assert.equal(hrefs.includes("/admin/shop"), true);
  assert.equal(hrefs.includes("/admin/users"), false);
  assert.equal(hrefs.includes("/admin/shop/orders"), false);
  assert.equal(getFirstAllowedAdminRoute(permissions), "/admin/operations");
});

test("disabled Ops UI is removed from navigation and cannot become the first allowed route", () => {
  const permissions = ["ops.tasks.read", "ops.knowledge.read", "shop.products.read"];
  const sections = filterAdminNavSections(permissions, undefined, {
    operationsUiEnabled: false,
  });
  const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));

  assert.equal(
    hrefs.some((href) => href.startsWith("/admin/operations")),
    false
  );
  assert.equal(
    getFirstAllowedAdminRoute(permissions, { operationsUiEnabled: false }),
    "/admin/shop"
  );
});

test("unused Operations sections stay out of the menu (owner, 2026-10-13)", () => {
  const everything = filterAdminNavSections(["*"]).flatMap((section) =>
    section.items.map((item) => item.href)
  );
  // Pages and data remain reachable by URL; they are only hidden from navigation.
  assert.equal(everything.includes("/admin/operations/approvals"), false);
  assert.equal(everything.includes("/admin/operations/projects"), false);
  assert.equal(everything.includes("/admin/operations/tasks"), true);
});

test("breadcrumbs name the section, the page and nested detail screens", () => {
  assert.deepEqual(getAdminBreadcrumbs("/admin"), [{ label: "Дашборд" }]);
  assert.deepEqual(getAdminBreadcrumbs("/admin/shop/orders"), [
    { label: "Продажі" },
    { label: "Центр замовлень" },
  ]);
  assert.deepEqual(getAdminBreadcrumbs("/admin/shop/orders/ord_1"), [
    { label: "Продажі" },
    { label: "Центр замовлень", href: "/admin/shop/orders" },
    { label: "Деталі" },
  ]);
  assert.deepEqual(getAdminBreadcrumbs("/admin/shop/new"), [
    { label: "Каталог" },
    { label: "Товари", href: "/admin/shop" },
    { label: "Новий товар" },
  ]);
  assert.deepEqual(getAdminBreadcrumbs("/admin/shop/import/jobs/job_1"), [
    { label: "Каталог" },
    { label: "Центр імпортів", href: "/admin/shop/import" },
    { label: "Журнал імпорту", href: "/admin/shop/import/jobs" },
    { label: "Деталі" },
  ]);
  assert.deepEqual(getAdminBreadcrumbs("/admin/shop/discounts/new"), [
    { label: "Маркетинг і контент" },
    { label: "Промокоди", href: "/admin/shop/discounts" },
    { label: "Створення" },
  ]);
  assert.deepEqual(getAdminBreadcrumbs("/admin/backups"), [{ label: "Резервні копії" }]);
});
