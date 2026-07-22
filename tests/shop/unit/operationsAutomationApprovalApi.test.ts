import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

test("manual automation API is canary-gated, versioned, idempotent and task-bound", () => {
  const route = source("src/app/api/admin/operations/tasks/[id]/automations/route.ts");
  for (const required of [
    "assertOperationsEnabled",
    "assertOpsAutomationsEnabled",
    "assertOpsMutationBoundary",
    "OPS_AUTOMATION_RUN",
    "OPS_TASKS_WRITE",
    "assertCanWriteTask",
    "requireIdempotencyKey",
    "requireIfMatch",
    "runOpsIdempotentMutation",
    "resolveOpsAutomationRequestTarget",
    "AUTOMATION_STARTED",
    "writeOpsAudit",
  ]) {
    assert.match(route, new RegExp(required), `automation route must use ${required}`);
  }
  assert.doesNotMatch(route, /\bfetch\s*\(/);
  assert.doesNotMatch(route, /shop(?:Order|Product)\.(?:create|update|delete)/);
  assert.doesNotMatch(route, /\$(?:executeRaw|queryRaw)/);
});

test("approval decision only records a reviewed immutable payload and executes no effect", () => {
  const route = source("src/app/api/admin/operations/approvals/[id]/decide/route.ts");
  for (const required of [
    "assertOperationsEnabled",
    "assertOpsMutationBoundary",
    "OPS_APPROVALS_DECIDE",
    "requireIdempotencyKey",
    "requireIfMatch",
    "runOpsIdempotentMutation",
    "assertOpsApprovalPayloadIntegrity",
    "assertOpsApprovalCanBeDecided",
    "opsTaskEvent.create",
    "writeOpsAudit",
    "effectExecuted: false",
  ]) {
    assert.match(route, new RegExp(required), `approval route must use ${required}`);
  }
  assert.doesNotMatch(route, /\bfetch\s*\(/);
  assert.doesNotMatch(route, /opsJob\.(?:create|update)/);
  assert.doesNotMatch(route, /shop(?:Order|Product)\.(?:create|update|delete)/);
  assert.doesNotMatch(route, /\$(?:executeRaw|queryRaw)/);
});

test("approval list is current-DB RBAC protected and bounded", () => {
  const route = source("src/app/api/admin/operations/approvals/route.ts");
  assert.match(route, /requireOperationsAccess\(ADMIN_PERMISSIONS\.OPS_APPROVALS_DECIDE\)/);
  assert.match(route, /Math\.min\(100/);
  assert.match(route, /effectiveOpsApprovalStatus/);
});
