import assert from "node:assert/strict";
import test from "node:test";

import {
  getShopAiRetentionCutoffs,
  SHOP_AI_AGGREGATE_RETENTION_MONTHS,
  SHOP_AI_DETAILED_TRACE_RETENTION_DAYS,
} from "../../../src/lib/shopAiRetention";

test("One AI retention keeps detailed traces for 30 days and aggregates for 12 months", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");
  const cutoffs = getShopAiRetentionCutoffs(now);

  assert.equal(SHOP_AI_DETAILED_TRACE_RETENTION_DAYS, 30);
  assert.equal(SHOP_AI_AGGREGATE_RETENTION_MONTHS, 12);
  assert.equal(cutoffs.detailedTraceBefore.toISOString(), "2026-06-17T12:00:00.000Z");
  assert.equal(cutoffs.aggregateBefore.toISOString(), "2025-07-17T12:00:00.000Z");
  assert.equal(cutoffs.expiredConversationBefore.toISOString(), now.toISOString());
});
