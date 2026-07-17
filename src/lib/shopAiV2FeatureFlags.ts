import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";
import {
  evaluateShopAiV2ReleaseActivationGuard,
  readShopAiV2ReleaseActivationGuardInput,
} from "@/lib/shopAiV2ReleaseActivationGuard";

export const SHOP_AI_V2_ROLLOUT_CATEGORIES = [
  "merch",
  "exhaust",
  "carbonAero",
  "brakes",
  "suspension",
  "performance",
  "chipTuning",
  "motoCarbon",
  "cooling",
  "wheels",
  "lighting",
  "interior",
  "accessories",
] as const satisfies readonly ShopStockCategoryGroupId[];

export type ShopAiV2RolloutCategory = (typeof SHOP_AI_V2_ROLLOUT_CATEGORIES)[number];

export const SHOP_AI_V2_ROLLOUT_PERCENTAGES = [0, 10, 50, 100] as const;

const SHOP_AI_V2_ROLLOUT_CATEGORY_SET = new Set<ShopStockCategoryGroupId>(
  SHOP_AI_V2_ROLLOUT_CATEGORIES
);
const SHOP_AI_V2_ROLLOUT_PERCENTAGE_SET = new Set<number>(SHOP_AI_V2_ROLLOUT_PERCENTAGES);

export function isShopAiV2RolloutCategory(category: unknown): category is ShopAiV2RolloutCategory {
  return (
    typeof category === "string" &&
    SHOP_AI_V2_ROLLOUT_CATEGORY_SET.has(category as ShopStockCategoryGroupId)
  );
}

function parseBoolean(value: string | undefined) {
  return value === "1" || value?.trim().toLowerCase() === "true";
}

function configuredCategories() {
  const raw = process.env.SHOP_AI_V2_CATEGORIES?.trim();
  if (!raw) return new Set<ShopAiV2RolloutCategory>();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(isShopAiV2RolloutCategory)
  );
}

function configuredCategoryPercentages() {
  const result = new Map<ShopAiV2RolloutCategory, number>();
  for (const entry of process.env.SHOP_AI_V2_CATEGORY_PERCENTAGES?.split(",") ?? []) {
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
    evaluateShopAiV2ReleaseActivationGuard(readShopAiV2ReleaseActivationGuardInput(process.env)).ok
  );
}

export function isShopAiV2ShadowEnabled() {
  return (
    parseBoolean(process.env.SHOP_AI_V2_SHADOW) &&
    evaluateShopAiV2ReleaseActivationGuard(readShopAiV2ReleaseActivationGuardInput(process.env)).ok
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
