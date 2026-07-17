import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

export const SHOP_KNOWLEDGE_BACKFILL_CATEGORIES = [
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
] as const satisfies readonly Exclude<ShopStockCategoryGroupId, "other">[];

const ALLOWED = new Set<string>(SHOP_KNOWLEDGE_BACKFILL_CATEGORIES);

export function parseShopKnowledgeBackfillCategories(
  argv: string[]
): Set<Exclude<ShopStockCategoryGroupId, "other">> {
  const values = argv
    .filter((argument) => argument.startsWith("--category="))
    .flatMap((argument) => argument.slice("--category=".length).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = new Set(values);
  for (const value of unique) {
    if (value === "other") {
      throw new Error('Knowledge V2 category "other" cannot be backfilled or committed');
    }
    if (!ALLOWED.has(value)) {
      throw new Error(`Unknown Knowledge V2 backfill category: ${value}`);
    }
  }
  return unique as Set<Exclude<ShopStockCategoryGroupId, "other">>;
}

export function isShopKnowledgeBackfillAllowed(
  category: ShopStockCategoryGroupId,
  selected: ReadonlySet<Exclude<ShopStockCategoryGroupId, "other">>
): boolean {
  return category !== "other" && (selected.size === 0 || selected.has(category));
}
