import { SHOP_STOCK_CATEGORY_GROUPS, type ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

export type ShopCategoryGroupSetting = {
  id: ShopStockCategoryGroupId;
  titleUa: string;
  titleEn: string;
  sortOrder: number;
  isPublished: boolean;
};

export type ShopCategoryGroupSettingRow = Partial<Omit<ShopCategoryGroupSetting, "id">> & {
  id: string;
};

/**
 * Code taxonomy defaults. Equal sort orders fall back to "biggest group first";
 * `other` sorts last unless an editor moves it.
 */
export function defaultShopCategoryGroupSettings(): ShopCategoryGroupSetting[] {
  return SHOP_STOCK_CATEGORY_GROUPS.map((group) => ({
    id: group.id,
    titleUa: group.ua,
    titleEn: group.en,
    sortOrder: group.id === "other" ? 10_000 : 0,
    isPublished: true,
  }));
}

/** Stored rows override the defaults field by field; unknown ids are ignored. */
export function mergeShopCategoryGroupSettings(
  rows: ShopCategoryGroupSettingRow[]
): ShopCategoryGroupSetting[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return defaultShopCategoryGroupSettings().map((base) => {
    const row = byId.get(base.id);
    if (!row) return base;
    return {
      id: base.id,
      titleUa: base.titleUa,
      titleEn: base.titleEn,
      sortOrder: Number.isFinite(row.sortOrder) ? Number(row.sortOrder) : base.sortOrder,
      isPublished: row.isPublished ?? base.isPublished,
    };
  });
}

export function normalizeShopCategoryGroupSettingsPayload(body: unknown): {
  data: ShopCategoryGroupSetting[];
  errors: string[];
} {
  const errors: string[] = [];
  const items = Array.isArray(body) ? body : (body as { groups?: unknown })?.groups;
  if (!Array.isArray(items)) return { data: [], errors: ["groups must be an array"] };
  const knownIds = new Set<string>(SHOP_STOCK_CATEGORY_GROUPS.map((group) => group.id));
  const seen = new Set<string>();
  const data: ShopCategoryGroupSetting[] = [];
  for (const item of items as Record<string, unknown>[]) {
    const id = typeof item?.id === "string" ? item.id : "";
    if (!knownIds.has(id)) {
      errors.push(`Unknown group: ${id || "(empty)"}`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`Duplicate group: ${id}`);
      continue;
    }
    seen.add(id);
    const sortOrder = Number(item.sortOrder);
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100_000) {
      errors.push(`${id}: sortOrder must be an integer`);
    }
    const base = SHOP_STOCK_CATEGORY_GROUPS.find((group) => group.id === id)!;
    data.push({
      id: id as ShopStockCategoryGroupId,
      titleUa: base.ua,
      titleEn: base.en,
      sortOrder,
      isPublished: item.isPublished !== false,
    });
  }
  return { data, errors };
}

type FacetItem = { key: string; label: string; count: number };

/**
 * Applies editor visibility and order to the category facet. Labels stay the code
 * taxonomy titles: filter values are submitted as labels, so renaming needs stable keys first.
 */
export function applyShopCategoryGroupSettingsToFacet<T extends FacetItem>(
  items: T[],
  settings: ShopCategoryGroupSetting[]
): T[] {
  const byId = new Map<string, ShopCategoryGroupSetting>(settings.map((item) => [item.id, item]));
  return items
    .filter((item) => byId.get(item.key)?.isPublished !== false)
    .sort((left, right) => {
      const leftOrder = byId.get(left.key)?.sortOrder ?? 5_000;
      const rightOrder = byId.get(right.key)?.sortOrder ?? 5_000;
      return leftOrder - rightOrder || right.count - left.count;
    });
}
