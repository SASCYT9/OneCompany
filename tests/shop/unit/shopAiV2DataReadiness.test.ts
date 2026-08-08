import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateShopAiV2DataReadinessFacts,
  validateShopAiV2DataReadinessSnapshot,
} from "../../../src/lib/shopAiV2DataReadinessContract";
import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../../../src/lib/shopAiV2RolloutContract";

const CATALOG_FINGERPRINT = "a".repeat(64);

function passingSnapshot() {
  return {
    schemaVersion: 1,
    checkedAt: "2026-08-07T12:00:00.000Z",
    catalogStable: true,
    catalogFingerprint: CATALOG_FINGERPRINT,
    catalogRevision: "7",
    embeddingModel: "gemini-embedding-2:search-v1",
    knowledge: {
      total: SHOP_AI_V2_ROLLOUT_CATEGORIES.length,
      ready: 6,
      needsReview: 7,
      pending: 0,
      processing: 0,
      failed: 0,
      blocked: 0,
      nonCanonical: 0,
    },
    embeddings: { totalChunks: 26, currentChunks: 26, pendingChunks: 0 },
    outbox: {
      pending: 0,
      processing: 0,
      retry: 0,
      completed: 13,
      deadLetter: 0,
      backlog: 0,
    },
    staleProcessingRuns: 0,
    countsByCategory: Object.fromEntries(
      SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => [category, 1])
    ),
    passed: true,
    errors: [] as string[],
  };
}

test("data readiness accepts only a complete canonical Knowledge V2 snapshot", () => {
  assert.deepEqual(validateShopAiV2DataReadinessSnapshot(passingSnapshot(), CATALOG_FINGERPRINT), {
    ok: true,
    errors: [],
  });
});

test("data readiness recomputes facts instead of trusting the reported pass flag", () => {
  const snapshot = passingSnapshot();
  snapshot.knowledge.ready = 5;
  snapshot.knowledge.processing = 1;
  snapshot.embeddings.currentChunks = 25;
  snapshot.embeddings.pendingChunks = 1;
  snapshot.outbox.deadLetter = 1;
  snapshot.knowledge.nonCanonical = 1;

  const validation = validateShopAiV2DataReadinessSnapshot(snapshot, CATALOG_FINGERPRINT);

  assert.equal(validation.ok, false);
  const errors = validation.errors.join("\n");
  assert.match(errors, /PROCESSING count must be zero/);
  assert.match(errors, /embedding backlog must be zero/);
  assert.match(errors, /DEAD_LETTER count must be zero/);
  assert.match(errors, /non-canonical/);
});

test("data readiness facts detect an unstable or mismatched catalog", () => {
  const snapshot = passingSnapshot();
  snapshot.catalogStable = false;
  snapshot.catalogFingerprint = "b".repeat(64);
  snapshot.passed = false;
  snapshot.errors = ["catalog changed"];

  const facts = evaluateShopAiV2DataReadinessFacts(snapshot, CATALOG_FINGERPRINT);
  const validation = validateShopAiV2DataReadinessSnapshot(snapshot, CATALOG_FINGERPRINT);

  assert.equal(facts.ok, false);
  assert.match(facts.errors.join("\n"), /catalog changed/);
  assert.match(facts.errors.join("\n"), /different catalog fingerprint/);
  assert.match(validation.errors.join("\n"), /snapshot did not pass/);
  assert.match(validation.errors.join("\n"), /reported errors/);
});
