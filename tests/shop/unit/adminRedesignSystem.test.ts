import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("shared admin primitives expose dashboard and settings building blocks", () => {
  const source = readRepoFile("src/components/admin/AdminPrimitives.tsx");

  for (const marker of [
    "AdminDashboardSection",
    "AdminInsightPanel",
    "AdminTrendChart",
    "AdminBarList",
    "AdminFunnelChart",
    "AdminQuickActionCard",
    "AdminSettingsShell",
    "AdminStickyActionBar",
    "AdminDangerZone",
  ]) {
    assert.match(source, new RegExp(`\\b${marker}\\b`));
  }
});

test("overview and system pages use the shared Phase 3 admin primitives", () => {
  const pageExpectations = [
    {
      path: "src/app/admin/settings/page.tsx",
      markers: ["AdminPageHeader", "AdminSettingsShell", "AdminStickyActionBar", "AdminDangerZone"],
    },
    {
      path: "src/app/admin/users/page.tsx",
      markers: [
        "AdminPageHeader",
        "AdminMetricGrid",
        "AdminActionBar",
        "AdminSplitDetailShell",
        "AdminInspectorCard",
      ],
    },
    {
      path: "src/app/admin/backups/page.tsx",
      markers: [
        "AdminPageHeader",
        "AdminMetricGrid",
        "AdminActionBar",
        "AdminSplitDetailShell",
        "AdminInspectorCard",
        "AdminTableShell",
      ],
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

// The overview was redesigned (19b0b586) with its own module styles; it must keep
// reading the consolidated dashboard contract instead of ad hoc requests.
test("overview renders the consolidated dashboard contract", () => {
  const source = readRepoFile("src/app/admin/page.tsx");
  assert.match(source, /from ["']@\/lib\/admin\/dashboardOverview["']/);
  assert.match(source, /DashboardOverview/);
});
