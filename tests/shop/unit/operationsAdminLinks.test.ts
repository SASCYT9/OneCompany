import assert from "node:assert/strict";
import test from "node:test";
import { opsAdminLink, resolveOpsAdminBaseUrl } from "../../../src/lib/operations/adminLinks";

test("production Telegram links always use the canonical company domain", () => {
  const environment = {
    NODE_ENV: "production",
    OPS_ADMIN_BASE_URL: "https://one-company-preview-owner-projects.vercel.app",
  };

  assert.equal(resolveOpsAdminBaseUrl(environment), "https://onecompany.global");
  assert.equal(
    opsAdminLink("/admin/operations/tasks/task-1", environment),
    "https://onecompany.global/admin/operations/tasks/task-1"
  );
});

test("local development can keep an explicit local admin origin", () => {
  const environment = {
    NODE_ENV: "development",
    OPS_ADMIN_BASE_URL: "http://127.0.0.1:3000/",
  };

  assert.equal(resolveOpsAdminBaseUrl(environment), "http://127.0.0.1:3000");
  assert.equal(
    opsAdminLink("admin/operations/inbox", environment),
    "http://127.0.0.1:3000/admin/operations/inbox"
  );
});
