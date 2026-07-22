import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavSections,
  getFirstAllowedAdminRoute,
  getActiveAdminNavItem,
  getActiveAdminNavSection,
  isAdminNavItemActive,
} from "../../../src/lib/admin/adminNavigation";

test("admin IA keeps the planned top-level section order", () => {
  assert.deepEqual(
    ADMIN_NAV_SECTIONS.map((section) => section.key),
    [
      "overview",
      "work",
      "orders",
      "customers",
      "catalog",
      "imports",
      "logistics",
      "content",
      "marketing",
      "operations",
      "system",
    ]
  );
});

test("catalog section keeps the phase-1 commerce modules together", () => {
  const catalogSection = ADMIN_NAV_SECTIONS.find((section) => section.key === "catalog");
  assert.ok(catalogSection);
  assert.deepEqual(
    catalogSection.items.map((item) => item.href),
    [
      "/admin/shop",
      "/admin/shop/inventory",
      "/admin/shop/categories",
      "/admin/shop/collections",
      "/admin/shop/bundles",
      "/admin/shop/media",
      "/admin/shop/quality",
      "/admin/shop/fitment",
      "/admin/shop/ai-quality",
      "/admin/shop/pricing",
      "/admin/shop/seo",
    ]
  );
});

test("imports section exposes feed exports beside import tooling", () => {
  const importsSection = ADMIN_NAV_SECTIONS.find((section) => section.key === "imports");
  assert.ok(importsSection);
  assert.deepEqual(
    importsSection.items.map((item) => item.href),
    [
      "/admin/shop/import",
      "/admin/shop/stock",
      "/admin/shop/feed",
      "/admin/shop/turn14",
      "/admin/shop/audit",
    ]
  );
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
  assert.equal(getActiveAdminNavItem("/admin/shop/feed")?.href, "/admin/shop/feed");
  assert.equal(getActiveAdminNavSection("/admin/shop/feed")?.key, "imports");
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

test("approval navigation is visible only to approval decision makers", () => {
  const withoutApproval = filterAdminNavSections(["ops.tasks.read"]);
  const withApproval = filterAdminNavSections(["ops.approvals.decide"]);
  const withoutHrefs = withoutApproval.flatMap((section) => section.items.map((item) => item.href));
  const withHrefs = withApproval.flatMap((section) => section.items.map((item) => item.href));

  assert.equal(withoutHrefs.includes("/admin/operations/approvals"), false);
  assert.equal(withHrefs.includes("/admin/operations/approvals"), true);
});
