import assert from "node:assert/strict";
import test from "node:test";

import {
  isShopKnowledgeBackfillAllowed,
  parseShopKnowledgeBackfillCategories,
  SHOP_KNOWLEDGE_BACKFILL_CATEGORIES,
} from "../../../src/lib/shopKnowledgeV2/backfillPolicy";

test("category-gated backfill accepts only explicit rollout categories", () => {
  const selected = parseShopKnowledgeBackfillCategories([
    "--category=exhaust,brakes",
    "--category=carbonAero",
  ]);

  assert.deepEqual(Array.from(selected), ["exhaust", "brakes", "carbonAero"]);
  assert.equal(isShopKnowledgeBackfillAllowed("exhaust", selected), true);
  assert.equal(isShopKnowledgeBackfillAllowed("wheels", selected), false);
  assert.equal(isShopKnowledgeBackfillAllowed("other", selected), false);
});

test("Other is excluded from both the rollout manifest and CLI commits", () => {
  assert.equal(SHOP_KNOWLEDGE_BACKFILL_CATEGORIES.includes("other" as never), false);
  assert.throws(
    () => parseShopKnowledgeBackfillCategories(["--category=other"]),
    /cannot be backfilled or committed/
  );
});

test("empty dry-run selection still excludes Other", () => {
  const selected = parseShopKnowledgeBackfillCategories([]);
  assert.equal(isShopKnowledgeBackfillAllowed("exhaust", selected), true);
  assert.equal(isShopKnowledgeBackfillAllowed("other", selected), false);
});
