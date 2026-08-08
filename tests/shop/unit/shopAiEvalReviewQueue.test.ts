import assert from "node:assert/strict";
import test from "node:test";

import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../../../src/lib/shopAiV2RolloutContract";
import {
  buildShopAiEvalReviewQueue,
  compileApprovedShopAiEvalReviewQueue,
  type ShopAiEvalReviewSeed,
} from "../../../scripts/shop-ai-eval-review-queue";

function seeds(): ShopAiEvalReviewSeed[] {
  return SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category, index) => ({
    category,
    productId: `real-product-${category}`,
    variantId: `real-variant-${category}`,
    sku: `SKU-${String(index + 1).padStart(2, "0")}`,
    titleUa: `Товар ${category}`,
    titleEn: `${category} product`,
    brand: "One Company",
    sourceEvidenceId: `knowledge-${category}-revision-1`,
  }));
}

test("review queue creates 500 balanced pending cases without pretending they were reviewed", () => {
  const queue = buildShopAiEvalReviewQueue({
    seeds: seeds(),
    categories: SHOP_AI_V2_ROLLOUT_CATEGORIES,
    generatedAt: new Date("2026-08-07T00:00:00.000Z"),
  });
  assert.equal(queue.items.length, 500);
  assert.equal(
    queue.items.every((item) => item.status === "pending"),
    true
  );
  assert.equal(
    queue.items.every((item) => item.reviewer === null),
    true
  );
  assert.equal(queue.items.filter((item) => item.draftCase.metadata?.hardNegative).length, 100);
  for (const category of SHOP_AI_V2_ROLLOUT_CATEGORIES) {
    assert.ok(queue.items.filter((item) => item.category === category).length >= 30);
  }
  for (const language of ["ua", "en", "ru", "mixed", "translit"]) {
    assert.equal(queue.items.filter((item) => item.language === language).length, 100);
  }
  assert.equal(new Set(queue.items.map((item) => item.draftCase.message)).size, 500);
});

test("review compiler refuses pending cases and only passes a fully evidenced corpus", () => {
  const queue = buildShopAiEvalReviewQueue({
    seeds: seeds(),
    categories: SHOP_AI_V2_ROLLOUT_CATEGORIES,
    generatedAt: new Date("2026-08-07T00:00:00.000Z"),
  });
  const pending = compileApprovedShopAiEvalReviewQueue(queue, {
    enabledCategories: [...SHOP_AI_V2_ROLLOUT_CATEGORIES],
  });
  assert.equal(pending.ok, false);
  assert.match(pending.errors.join("\n"), /approved 0\/500/);

  for (const item of queue.items) {
    item.status = "approved";
    item.reviewer = "catalog-reviewer";
    item.reviewedAt = "2026-08-07T12:00:00.000Z";
    item.reviewEvidenceId = `ONEAI-REVIEW:${item.id}`;
  }
  const approved = compileApprovedShopAiEvalReviewQueue(queue, {
    enabledCategories: [...SHOP_AI_V2_ROLLOUT_CATEGORIES],
  });
  assert.equal(approved.ok, true, approved.errors.join("\n"));
  assert.equal(approved.cases.length, 500);
  assert.equal(approved.gate?.passed, true);
});
