import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { OpsJobStage, OpsJobStatus } from "@prisma/client";

import { evaluateAdminRouteAccess } from "../../../src/lib/admin/adminRouteAccess";
import {
  filterAdminNavSections,
  flattenAdminNavItems,
} from "../../../src/lib/admin/adminNavigation";
import { OpsError } from "../../../src/lib/operations/errors";
import {
  assertOpsSystemJobRetryable,
  opsSystemManualRetryData,
  toOpsSystemJobSummary,
  type OpsSystemJobRow,
} from "../../../src/lib/operations/system";
import { getOpsMediaConfiguration } from "../../../src/lib/operations/media";

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

test("Ops System job summaries use an allowlisted projection and never expose raw content", () => {
  const now = new Date("2026-07-20T08:00:00.000Z");
  const unsafeRuntimeRow = {
    id: "job-1",
    type: "customer@example.com private delivery address",
    status: OpsJobStatus.DEAD_LETTER,
    stage: OpsJobStage.EXTRACT,
    errorType: "customer@example.com",
    errorMessage: "Bearer secret-token private address and payment card",
    payload: {
      originalMessage: "private Telegram message",
      address: "private delivery address",
      payment: "card details",
      token: "secret-token",
    },
    result: {
      transcription: "private transcript",
    },
    attempts: 4,
    maxAttempts: 4,
    availableAt: now,
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
    task: {
      id: "task-1",
      externalId: "TSK-0001",
      title: "Private task title with card details",
    },
    inboxItem: {
      id: "inbox-1",
      extractionStatus: "FAILED",
      reviewStatus: "PENDING",
      createdAt: now,
    },
  } as unknown as OpsSystemJobRow;

  const summary = toOpsSystemJobSummary(unsafeRuntimeRow);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.type, "internal_job");
  assert.deepEqual(summary.error, {
    type: "JOB_STAGE_FAILED",
    message: "Этап завершился ошибкой. Детали доступны только в серверных логах.",
  });
  for (const forbidden of [
    "customer@example.com",
    "private delivery address",
    "payment card",
    "private Telegram message",
    "private transcript",
    "Private task title",
    "secret-token",
    '"payload"',
    '"result"',
    '"errorMessage"',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `system health must redact ${forbidden}`);
  }
});

test("Ops media readiness is secret-free and rejects local storage in production", () => {
  assert.deepEqual(
    getOpsMediaConfiguration({
      NODE_ENV: "development",
      OPS_LOCAL_MEDIA_DIR: ".ops-data/media",
      OPS_BLOB_READ_WRITE_TOKEN: "blob-secret",
      OPS_BLOB_STORE_ID: "",
    }),
    {
      provider: "local",
      configured: true,
      productionReady: false,
    }
  );
  assert.deepEqual(
    getOpsMediaConfiguration({
      NODE_ENV: "production",
      OPS_LOCAL_MEDIA_DIR: ".ops-data/media",
      OPS_BLOB_READ_WRITE_TOKEN: "blob-secret",
      OPS_BLOB_STORE_ID: "",
    }),
    {
      provider: "invalid",
      configured: false,
      productionReady: false,
    }
  );
  assert.deepEqual(
    getOpsMediaConfiguration({
      NODE_ENV: "production",
      OPS_LOCAL_MEDIA_DIR: "",
      OPS_BLOB_READ_WRITE_TOKEN: "blob-secret",
      OPS_BLOB_STORE_ID: "",
    }),
    {
      provider: "vercel_blob",
      configured: true,
      productionReady: true,
    }
  );
  assert.equal(
    JSON.stringify(
      getOpsMediaConfiguration({
        NODE_ENV: "production",
        OPS_LOCAL_MEDIA_DIR: "",
        OPS_BLOB_READ_WRITE_TOKEN: "blob-secret",
        OPS_BLOB_STORE_ID: "",
      })
    ).includes("blob-secret"),
    false
  );

  assert.deepEqual(
    getOpsMediaConfiguration({
      NODE_ENV: "production",
      OPS_LOCAL_MEDIA_DIR: "",
      OPS_BLOB_READ_WRITE_TOKEN: "",
      OPS_BLOB_STORE_ID: "store_private",
    }),
    {
      provider: "vercel_blob",
      configured: true,
      productionReady: true,
    }
  );
  assert.deepEqual(
    getOpsMediaConfiguration({
      NODE_ENV: "production",
      OPS_LOCAL_MEDIA_DIR: "",
      OPS_BLOB_READ_WRITE_TOKEN: "",
      BLOB_READ_WRITE_TOKEN: "blob-integration-secret",
      OPS_BLOB_STORE_ID: "",
    }),
    {
      provider: "vercel_blob",
      configured: true,
      productionReady: true,
    }
  );
});

test("manual System retry only accepts terminal human-action states and starts a bounded cycle", () => {
  for (const status of [OpsJobStatus.DEAD_LETTER, OpsJobStatus.WAITING_HUMAN]) {
    assert.doesNotThrow(() =>
      assertOpsSystemJobRetryable({
        status,
        leaseOwner: null,
        leaseExpiresAt: null,
      })
    );
  }

  for (const status of [
    OpsJobStatus.QUEUED,
    OpsJobStatus.RUNNING,
    OpsJobStatus.SUCCEEDED,
    OpsJobStatus.FAILED,
    OpsJobStatus.CANCELLED,
  ]) {
    assert.throws(
      () =>
        assertOpsSystemJobRetryable({
          status,
          leaseOwner: null,
          leaseExpiresAt: null,
        }),
      (error) =>
        error instanceof OpsError && error.code === "JOB_NOT_RETRYABLE" && error.status === 409
    );
  }

  assert.throws(
    () =>
      assertOpsSystemJobRetryable({
        status: OpsJobStatus.DEAD_LETTER,
        leaseOwner: "worker-1",
        leaseExpiresAt: new Date("2026-07-20T08:01:00.000Z"),
      }),
    (error) =>
      error instanceof OpsError && error.code === "JOB_RETRY_CONFLICT" && error.status === 409
  );

  const now = new Date("2026-07-20T08:00:00.000Z");
  assert.deepEqual(opsSystemManualRetryData({ maxAttempts: 99, now }), {
    status: OpsJobStatus.QUEUED,
    attempts: 0,
    maxAttempts: 4,
    availableAt: now,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    cancelRequestedAt: null,
    startedAt: null,
    finishedAt: null,
    errorType: null,
    errorMessage: null,
  });
});

test("Ops System route is current-DB RBAC protected, CSRF safe, idempotent and audited", () => {
  const route = source("src/app/api/admin/operations/system/route.ts");
  const domain = source("src/lib/operations/system.ts");

  for (const required of [
    "assertOperationsEnabled",
    "requireOperationsAccess",
    "OPS_SYSTEM_MANAGE",
    "assertOpsMutationBoundary",
    "requireIdempotencyKey",
    "runOpsIdempotentMutation",
    "retryOpsSystemJob",
    "writeOpsAudit",
    "system.job.retry",
    "reusedDurableJob: true",
  ]) {
    assert.match(route, new RegExp(required), `system route must use ${required}`);
  }
  assert.match(domain, /status:\s*job\.status/);
  assert.match(domain, /leaseOwner:\s*null/);
  assert.match(domain, /leaseExpiresAt:\s*null/);
  assert.match(domain, /attempts:\s*0/);
  assert.doesNotMatch(route, /\bfetch\s*\(/);
  assert.doesNotMatch(route, /shop(?:Order|Product)\.(?:create|update|delete)/);
  assert.doesNotMatch(route, /opsJob\.create/);
  assert.doesNotMatch(domain, /opsJob\.create/);
  assert.doesNotMatch(route, /\$(?:executeRaw|queryRaw)/);
});

test("Ops System page and API remain default-deny without the exact system permission", () => {
  for (const input of [
    { pathname: "/admin/operations/system", method: "GET" },
    { pathname: "/api/admin/operations/system", method: "GET" },
    { pathname: "/api/admin/operations/system", method: "POST" },
  ]) {
    assert.equal(
      evaluateAdminRouteAccess({
        ...input,
        permissions: ["ops.tasks.read"],
      }).reason,
      "FORBIDDEN"
    );
    assert.equal(
      evaluateAdminRouteAccess({
        ...input,
        permissions: ["ops.system.manage"],
      }).allowed,
      true
    );
  }

  assert.equal(
    evaluateAdminRouteAccess({
      pathname: "/api/admin/operations/system/unregistered",
      method: "POST",
      permissions: ["*"],
    }).reason,
    "UNREGISTERED_ROUTE"
  );
});

test("Ops System UI is permission-gated, responsive, and only retries the selected durable job", () => {
  const page = source("src/app/admin/operations/system/page.tsx");
  const ui = source("src/components/admin/operations/OpsSystem.tsx");

  assert.match(page, /requireOpsPageAccess\(\s*ADMIN_PERMISSIONS\.OPS_SYSTEM_MANAGE/);
  assert.match(ui, /\/api\/admin\/operations\/system\?take=50/);
  assert.match(ui, /action:\s*"retry"/);
  assert.match(ui, /jobId:\s*selectedJob\.id/);
  assert.match(ui, /sm:grid-cols/);
  assert.match(ui, /data-ops-media-store-status/);
  assert.match(ui, /pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.doesNotMatch(ui, /window\.(?:prompt|confirm)/);
  assert.doesNotMatch(ui, /dangerouslySetInnerHTML|contentEditable/);
});

test("Ops System navigation is visible only with ops.system.manage", () => {
  const systemOnly = flattenAdminNavItems(filterAdminNavSections(["ops.system.manage"])).map(
    (item) => item.href
  );
  const taskOnly = flattenAdminNavItems(filterAdminNavSections(["ops.tasks.read"])).map(
    (item) => item.href
  );

  assert.equal(systemOnly.includes("/admin/operations/system"), true);
  assert.equal(systemOnly.includes("/admin/operations/tasks"), false);
  assert.equal(taskOnly.includes("/admin/operations/system"), false);
});
