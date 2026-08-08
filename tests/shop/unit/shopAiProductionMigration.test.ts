import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260807120000_one_ai_production_upgrade",
  "migration.sql"
);

test("OneAI production migration is additive and keeps historical attribution nullable", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  for (const column of [
    "pipeline",
    "retrievalPath",
    "providerModel",
    "plannerLatencyMs",
    "degradedReason",
    "oneAiRunId",
    "oneAiCandidateDecisionId",
  ]) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`));
  }
  assert.match(sql, /ALTER TYPE "ShopAiFeedbackSignal" ADD VALUE IF NOT EXISTS 'MANAGER_HANDOFF'/);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+"(?:ShopCartItem|ShopOrderItem)"\b/i);
  assert.match(sql, /ON DELETE SET NULL/g);
});
