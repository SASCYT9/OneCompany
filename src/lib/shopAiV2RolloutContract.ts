import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

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

const SHOP_AI_V2_ROLLOUT_CATEGORY_SET = new Set<ShopStockCategoryGroupId>(
  SHOP_AI_V2_ROLLOUT_CATEGORIES
);

export function isShopAiV2RolloutCategory(category: unknown): category is ShopAiV2RolloutCategory {
  return (
    typeof category === "string" &&
    SHOP_AI_V2_ROLLOUT_CATEGORY_SET.has(category as ShopStockCategoryGroupId)
  );
}
