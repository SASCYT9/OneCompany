import assert from "node:assert/strict";
import test from "node:test";

import {
  getShopAiV2CategoryRolloutPercent,
  isShopAiV2CategoryEnabled,
  isShopAiV2Enabled,
  isShopAiV2ExactSkuBaselineEnabled,
  isShopAiV2OneShotProductionConfig,
  isShopAiV2RolloutCategory,
  isShopAiV2ShadowEnabled,
  SHOP_AI_V2_ROLLOUT_CATEGORIES,
} from "../../../src/lib/shopAiV2FeatureFlags";
import { createShopAiV2ReleaseGateMarker } from "../../../src/lib/shopAiV2ReleaseActivationGuard";
import type { ShopStockCategoryGroupId } from "../../../src/lib/shopStockTaxonomy";

const RELEASE_COMMIT_SHA = "a".repeat(40);
const RELEASE_CATALOG_FINGERPRINT = "e".repeat(64);
const RELEASE_SIGNING_SECRET = "release-gate-secret-with-at-least-32-bytes";

function expiredReleaseMarker() {
  return createShopAiV2ReleaseGateMarker(
    {
      commitSha: RELEASE_COMMIT_SHA,
      corpusSha256: "c".repeat(64),
      evalReportSha256: "d".repeat(64),
      catalogFingerprint: RELEASE_CATALOG_FINGERPRINT,
      evaluatedAt: "2026-07-17T12:00:00.000Z",
      expiresAt: "2026-07-18T12:00:00.000Z",
      repository: "one-company/storefront",
      workflowRunId: "123456789",
      workflowRunAttempt: 1,
    },
    RELEASE_SIGNING_SECRET
  );
}

function withFeatureFlagEnvironment(
  values: Record<string, string | undefined>,
  callback: () => void
) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("global and category flags fail closed", () => {
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "0",
      SHOP_AI_V2_CATEGORIES: "exhaust",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "exhaust:100",
    },
    () => assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), false)
  );

  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_CATEGORIES: "brakes",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "exhaust:100",
    },
    () => assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), false)
  );
});

test("exact SKU baseline has a separate flag and still honors the global kill switch", () => {
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "0",
      SHOP_AI_V2_EXACT_SKU_ENABLED: "1",
    },
    () => assert.equal(isShopAiV2ExactSkuBaselineEnabled(), false)
  );
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_EXACT_SKU_ENABLED: "0",
    },
    () => assert.equal(isShopAiV2ExactSkuBaselineEnabled(), false)
  );
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_EXACT_SKU_ENABLED: "1",
    },
    () => assert.equal(isShopAiV2ExactSkuBaselineEnabled(), true)
  );
});

test("runtime feature flags fail closed in production without a commit-bound release marker", () => {
  withFeatureFlagEnvironment(
    {
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_SHADOW: "1",
      SHOP_AI_V2_CATEGORIES: "exhaust",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "exhaust:100",
      SHOP_AI_V2_RELEASE_GATE_MARKER: undefined,
      SHOP_AI_V2_RELEASE_GATE_SIGNING_SECRET: undefined,
    },
    () => {
      assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), false);
      assert.equal(isShopAiV2ExactSkuBaselineEnabled(), false);
      assert.equal(isShopAiV2ShadowEnabled(), false);
    }
  );
});

test("runtime keeps an immutable production deployment enabled after marker TTL", () => {
  const allCategories = SHOP_AI_V2_ROLLOUT_CATEGORIES.join(",");
  const allPercentages = SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => `${category}:100`).join(
    ","
  );

  withFeatureFlagEnvironment(
    {
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: RELEASE_COMMIT_SHA,
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_EXACT_SKU_ENABLED: "1",
      SHOP_AI_V2_CATEGORIES: allCategories,
      SHOP_AI_V2_CATEGORY_PERCENTAGES: allPercentages,
      SHOP_AI_V2_CATALOG_FINGERPRINT: RELEASE_CATALOG_FINGERPRINT,
      SHOP_AI_V2_RELEASE_GATE_MARKER: expiredReleaseMarker(),
      SHOP_AI_V2_RELEASE_GATE_SIGNING_SECRET: RELEASE_SIGNING_SECRET,
    },
    () => {
      assert.equal(isShopAiV2Enabled(), true);
      assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), true);
      assert.equal(isShopAiV2ExactSkuBaselineEnabled(), true);
    }
  );
});

test("production serving config is one-shot across all canonical categories and exact SKU", () => {
  const allCategories = SHOP_AI_V2_ROLLOUT_CATEGORIES.join(",");
  const allPercentages = SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => `${category}:100`).join(
    ","
  );

  assert.equal(
    isShopAiV2OneShotProductionConfig({
      VERCEL_ENV: "production",
      SHOP_AI_V2_CATEGORIES: "exhaust,brakes",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "exhaust:100,brakes:100",
      SHOP_AI_V2_EXACT_SKU_ENABLED: "1",
    }),
    false
  );
  assert.equal(
    isShopAiV2OneShotProductionConfig({
      VERCEL_ENV: "production",
      SHOP_AI_V2_CATEGORIES: allCategories,
      SHOP_AI_V2_CATEGORY_PERCENTAGES: allPercentages,
      SHOP_AI_V2_EXACT_SKU_ENABLED: "1",
    }),
    true
  );
  assert.equal(
    isShopAiV2OneShotProductionConfig({
      VERCEL_ENV: "production",
      SHOP_AI_MODEL: "gemini-2.5-flash",
      SHOP_AI_V2_CATEGORIES: allCategories,
      SHOP_AI_V2_CATEGORY_PERCENTAGES: allPercentages,
      SHOP_AI_V2_EXACT_SKU_ENABLED: "1",
    }),
    false
  );
  assert.equal(
    isShopAiV2OneShotProductionConfig({
      VERCEL_ENV: "production",
      SHOP_AI_V2_CATEGORIES: allCategories,
      SHOP_AI_V2_CATEGORY_PERCENTAGES: allPercentages,
      SHOP_AI_V2_EXACT_SKU_ENABLED: "0",
    }),
    false
  );
});

test("production detection ignores empty higher-priority environment variables", () => {
  const allCategories = SHOP_AI_V2_ROLLOUT_CATEGORIES.join(",");
  const allPercentages = SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => `${category}:100`).join(
    ","
  );
  const environment: Partial<NodeJS.ProcessEnv> = {
    VERCEL_ENV: "",
    VERCEL_TARGET_ENV: "  ",
    NODE_ENV: "production",
    SHOP_AI_V2_CATEGORIES: allCategories,
    SHOP_AI_V2_CATEGORY_PERCENTAGES: allPercentages,
    SHOP_AI_V2_EXACT_SKU_ENABLED: "1",
  };

  assert.equal(isShopAiV2OneShotProductionConfig(environment), true);
  assert.equal(
    isShopAiV2OneShotProductionConfig({
      ...environment,
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "exhaust:100",
    }),
    false
  );
});

test("category rollout supports zero and full traffic gates", () => {
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_CATEGORIES: "exhaust,carbonAero",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "exhaust:0,carbonAero:100",
    },
    () => {
      assert.equal(getShopAiV2CategoryRolloutPercent("exhaust"), 0);
      assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), false);
      assert.equal(isShopAiV2CategoryEnabled("carbonAero", "visitor"), true);
    }
  );
});

test("configured category without an explicit percentage fails closed", () => {
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_CATEGORIES: "exhaust",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: undefined,
    },
    () => {
      assert.equal(getShopAiV2CategoryRolloutPercent("exhaust"), 0);
      assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), false);
    }
  );

  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_CATEGORIES: "exhaust,brakes",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "brakes:100",
    },
    () => {
      assert.equal(getShopAiV2CategoryRolloutPercent("exhaust"), 0);
      assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), false);
    }
  );
});

test("rollout accepts only the approved 0, 10, 50 and 100 percent stages", () => {
  for (const unsupportedPercent of [1, 5, 25, 99]) {
    withFeatureFlagEnvironment(
      {
        SHOP_AI_V2_ENABLED: "1",
        SHOP_AI_V2_CATEGORIES: "exhaust",
        SHOP_AI_V2_CATEGORY_PERCENTAGES: `exhaust:${unsupportedPercent}`,
      },
      () => {
        assert.equal(getShopAiV2CategoryRolloutPercent("exhaust"), 0);
        assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor"), false);
      }
    );
  }

  for (const supportedPercent of [0, 10, 50, 100]) {
    withFeatureFlagEnvironment(
      {
        SHOP_AI_V2_ENABLED: "1",
        SHOP_AI_V2_CATEGORIES: "exhaust",
        SHOP_AI_V2_CATEGORY_PERCENTAGES: `exhaust:${supportedPercent}`,
      },
      () => assert.equal(getShopAiV2CategoryRolloutPercent("exhaust"), supportedPercent)
    );
  }
});

test("partial rollout is deterministic and requires a bucket key", () => {
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_CATEGORIES: "exhaust",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "exhaust:50",
    },
    () => {
      const first = isShopAiV2CategoryEnabled("exhaust", "visitor-42");
      assert.equal(isShopAiV2CategoryEnabled("exhaust", "visitor-42"), first);
      assert.equal(isShopAiV2CategoryEnabled("exhaust"), false);
    }
  );
});

test("null, other, and unknown categories can never be enabled", () => {
  withFeatureFlagEnvironment(
    {
      SHOP_AI_V2_ENABLED: "1",
      SHOP_AI_V2_CATEGORIES: "merch,other,unknown",
      SHOP_AI_V2_CATEGORY_PERCENTAGES: "merch:100,other:100,unknown:100",
    },
    () => {
      assert.equal(getShopAiV2CategoryRolloutPercent(null), 0);
      assert.equal(isShopAiV2CategoryEnabled(null, "visitor"), false);
      assert.equal(getShopAiV2CategoryRolloutPercent("other"), 0);
      assert.equal(isShopAiV2CategoryEnabled("other", "visitor"), false);

      const unknownCategory = "unknown" as ShopStockCategoryGroupId;
      assert.equal(getShopAiV2CategoryRolloutPercent(unknownCategory), 0);
      assert.equal(isShopAiV2CategoryEnabled(unknownCategory, "visitor"), false);
    }
  );
});

test("canonical rollout category helper excludes unsupported categories", () => {
  assert.equal(isShopAiV2RolloutCategory("exhaust"), true);
  assert.equal(isShopAiV2RolloutCategory("other"), false);
  assert.equal(isShopAiV2RolloutCategory("unknown"), false);
  assert.equal(isShopAiV2RolloutCategory(null), false);
  assert.equal(SHOP_AI_V2_ROLLOUT_CATEGORIES.includes("exhaust"), true);
  assert.equal((SHOP_AI_V2_ROLLOUT_CATEGORIES as readonly string[]).includes("other"), false);
});
