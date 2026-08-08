import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryPath = path.join(process.cwd(), "src", "lib", "admin", "oneAiQualityRepository.ts");

test("OneAI category metrics only count current active knowledge evidence", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  assert.match(source, /revision\."revision" = knowledge\."revision"/);
  assert.match(source, /revision\."status"::text AS "status"/);
  assert.match(source, /revision\."snapshot"->>'categoryGroup'/);
  assert.doesNotMatch(source, /chunk\."isActive" = true/);
  assert.match(source, /application\."revision" = knowledge\."activeRevision"/);
  assert.match(source, /application\."isActive" = true/);
  assert.match(source, /application\."verificationStatus"::text = 'VERIFIED'/);
  assert.match(source, /evidence\."revision" = knowledge\."activeRevision"/);
  assert.match(source, /evidence\."isActive" = true/);
  assert.match(source, /evidence\."source"::text = 'MANAGER'/);
  assert.match(source, /evidence\."source"::text = 'MANUAL_OVERRIDE'/);
  assert.match(source, /evidence\."source"::text = 'SUPPLIER'/);
});

test("OneAI category dashboard exposes the complete production funnel", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  for (const metric of [
    "readyKnowledge",
    "needsReviewKnowledge",
    "pendingKnowledge",
    "processingKnowledge",
    "embeddingBacklog",
    "verifiedApplications",
    "exactRate",
    "reviewableRate",
    "noMatchRate",
    "degradedRate",
    "p50LatencyMs",
    "p95LatencyMs",
    "ctr",
    "handoffRate",
    "addToCartRate",
    "orderConversionRate",
  ]) {
    assert.match(source, new RegExp(`"${metric}"`));
  }

  assert.match(source, /feedback\."signal"::text = 'MANAGER_HANDOFF'/);
  assert.match(source, /feedback\."signal"::text = 'ORDER_COMPLETED'/);
});
