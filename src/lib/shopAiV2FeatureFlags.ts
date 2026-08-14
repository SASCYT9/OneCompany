import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";
import { SHOP_AI_DEFAULT_MODEL } from "@/lib/shopAiProviderPolicy";
import {
  evaluateShopAiV2ReleaseActivationGuard,
  readShopAiV2ReleaseActivationGuardInput,
} from "@/lib/shopAiV2ReleaseActivationGuard";
import {
  isShopAiV2RolloutCategory,
  SHOP_AI_V2_ROLLOUT_CATEGORIES,
  type ShopAiV2RolloutCategory,
} from "@/lib/shopAiV2RolloutContract";

export {
  isShopAiV2RolloutCategory,
  SHOP_AI_V2_ROLLOUT_CATEGORIES,
  type ShopAiV2RolloutCategory,
} from "@/lib/shopAiV2RolloutContract";

export const SHOP_AI_V2_ROLLOUT_PERCENTAGES = [0, 10, 50, 100] as const;

// One AI must fail closed without taking the storefront down. Request-time
// checks validate the marker signature, deployed commit, catalog fingerprint,
// and rollout contract. Marker expiry is intentionally ignored only after a
// commit-bound deployment exists; a marker for another commit still disables V2.
const SHOP_AI_V2_RUNTIME_GUARD_OPTIONS = { enforceMarkerExpiry: false } as const;

const SHOP_AI_V2_ROLLOUT_PERCENTAGE_SET = new Set<number>(SHOP_AI_V2_ROLLOUT_PERCENTAGES);

function parseBoolean(value: string | undefined) {
  return value === "1" || value?.trim().toLowerCase() === "true";
}

function configuredCategories(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const raw = environment.SHOP_AI_V2_CATEGORIES?.trim();
  if (!raw) return new Set<ShopAiV2RolloutCategory>();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(isShopAiV2RolloutCategory)
  );
}

function configuredCategoryPercentages(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const result = new Map<ShopAiV2RolloutCategory, number>();
  for (const entry of environment.SHOP_AI_V2_CATEGORY_PERCENTAGES?.split(",") ?? []) {
    const [rawCategory, rawPercent] = entry.split(":");
    const category = rawCategory?.trim();
    const percent = Number(rawPercent);
    if (
      !isShopAiV2RolloutCategory(category) ||
      !Number.isInteger(percent) ||
      !SHOP_AI_V2_ROLLOUT_PERCENTAGE_SET.has(percent)
    ) {
      continue;
    }
    result.set(category, percent);
  }
  return result;
}

function isProductionEnvironment(environment: Partial<NodeJS.ProcessEnv>) {
  const value = [
    environment.VERCEL_ENV,
    environment.VERCEL_TARGET_ENV,
    environment.SHOP_AI_DEPLOYMENT_ENV,
    environment.NODE_ENV,
  ]
    .find((candidate) => Boolean(candidate?.trim()))
    ?.trim()
    .toLowerCase();
  return value === "production" || value === "prod";
}

export function isShopAiV2OneShotProductionConfig(
  environment: Partial<NodeJS.ProcessEnv> = process.env
) {
  if (!isProductionEnvironment(environment)) return true;
  const categories = configuredCategories(environment);
  const percentages = configuredCategoryPercentages(environment);
  const plannerModel = environment.SHOP_AI_MODEL?.trim() || SHOP_AI_DEFAULT_MODEL;
  return (
    plannerModel === SHOP_AI_DEFAULT_MODEL &&
    parseBoolean(environment.SHOP_AI_V2_EXACT_SKU_ENABLED) &&
    categories.size === SHOP_AI_V2_ROLLOUT_CATEGORIES.length &&
    SHOP_AI_V2_ROLLOUT_CATEGORIES.every(
      (category) => categories.has(category) && percentages.get(category) === 100
    )
  );
}

function stableRolloutBucket(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function isShopAiV2Enabled() {
  return (
    parseBoolean(process.env.SHOP_AI_V2_ENABLED) &&
    evaluateShopAiV2ReleaseActivationGuard(
      readShopAiV2ReleaseActivationGuardInput(process.env),
      SHOP_AI_V2_RUNTIME_GUARD_OPTIONS
    ).ok &&
    isShopAiV2OneShotProductionConfig(process.env)
  );
}

export function isShopAiV2ShadowEnabled() {
  return (
    parseBoolean(process.env.SHOP_AI_V2_SHADOW) &&
    evaluateShopAiV2ReleaseActivationGuard(
      readShopAiV2ReleaseActivationGuardInput(process.env),
      SHOP_AI_V2_RUNTIME_GUARD_OPTIONS
    ).ok
  );
}

export function isShopAiV2ExactSkuBaselineEnabled() {
  return isShopAiV2Enabled() && parseBoolean(process.env.SHOP_AI_V2_EXACT_SKU_ENABLED);
}

export function getShopAiV2CategoryRolloutPercent(category: ShopStockCategoryGroupId | null) {
  if (!isShopAiV2RolloutCategory(category)) return 0;
  return configuredCategoryPercentages().get(category) ?? 0;
}

export function isShopAiV2CategoryEnabled(
  category: ShopStockCategoryGroupId | null,
  bucketKey?: string
) {
  if (!isShopAiV2Enabled() || !isShopAiV2RolloutCategory(category)) return false;
  const enabled = configuredCategories();
  if (!enabled.has(category)) return false;
  const percent = getShopAiV2CategoryRolloutPercent(category);
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  if (!bucketKey) return false;
  return stableRolloutBucket(`${category}:${bucketKey}`) < percent;
}

export function getShopAiV2RolloutCategories() {
  return SHOP_AI_V2_ROLLOUT_CATEGORIES.filter((category) => configuredCategories().has(category));
}
