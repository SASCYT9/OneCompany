import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  evaluateAdminRouteAccess,
  isRegisteredAdminRoute,
} from "../../../src/lib/admin/adminRouteAccess";

test("new admin route policy is default-deny", () => {
  const decision = evaluateAdminRouteAccess({
    pathname: "/api/admin/operations/unregistered",
    method: "POST",
    permissions: ["*"],
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "UNREGISTERED_ROUTE");
});

test("Ops route policy separates read, write and review permissions", () => {
  assert.equal(
    evaluateAdminRouteAccess({
      pathname: "/api/admin/operations/tasks",
      method: "GET",
      permissions: ["ops.tasks.read"],
    }).allowed,
    true
  );
  assert.equal(
    evaluateAdminRouteAccess({
      pathname: "/api/admin/operations/tasks",
      method: "POST",
      permissions: ["ops.tasks.read"],
    }).reason,
    "FORBIDDEN"
  );
  assert.equal(
    evaluateAdminRouteAccess({
      pathname: "/api/admin/operations/inbox/inbox-1/apply",
      method: "POST",
      permissions: ["ops.inbox.review"],
    }).allowed,
    true
  );
});

test("every implemented Ops admin route method is registered", () => {
  const root = path.join(process.cwd(), "src", "app", "api", "admin", "operations");
  if (!fs.existsSync(root)) {
    return;
  }

  const routeFiles: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.name === "route.ts") {
        routeFiles.push(absolute);
      }
    }
  };
  visit(root);

  for (const routeFile of routeFiles) {
    const relativeDirectory = path.relative(root, path.dirname(routeFile));
    const suffix = relativeDirectory
      .split(path.sep)
      .filter(Boolean)
      .map((segment) =>
        segment.startsWith("[") && segment.endsWith("]") ? `test-${segment.slice(1, -1)}` : segment
      )
      .join("/");
    const pathname = `/api/admin/operations${suffix ? `/${suffix}` : ""}`;
    const source = fs.readFileSync(routeFile, "utf8");
    assert.match(
      source,
      /\b(?:requireOperationsAccess|assertCurrentAdminAccess|assertCurrentAdminAnyPermission)\b/,
      `${pathname} must resolve current DB-backed admin access`
    );
    const methods = Array.from(
      source.matchAll(
        /export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\b/g
      ),
      (match) => match[1]
    );

    for (const method of methods) {
      assert.equal(
        isRegisteredAdminRoute(pathname, method),
        true,
        `${method} ${pathname} is missing from ADMIN_ROUTE_POLICY`
      );
    }
  }
});
