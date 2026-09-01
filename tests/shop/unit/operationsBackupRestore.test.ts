import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production backup restore target includes the source vector extension", () => {
  const source = readFileSync("scripts/operations/verify-phase0-restore.ts", "utf8");

  assert.match(source, /const RESTORE_IMAGE = "pgvector\/pgvector:0\.8\.2-pg17"/);
  assert.match(source, /temporaryTarget: RESTORE_IMAGE/);
  assert.doesNotMatch(source, /temporaryTarget: "postgres:17"/);
});
