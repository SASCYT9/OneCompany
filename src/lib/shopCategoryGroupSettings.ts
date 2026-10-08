import { normalizeShopSearchText } from "@/lib/shopSearch";
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

const MAX_TITLE_LENGTH = 80;

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
      titleUa: row.titleUa?.trim() || base.titleUa,
      titleEn: row.titleEn?.trim() || base.titleEn,
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
    const titleUa = typeof item.titleUa === "string" ? item.titleUa.trim() : "";
    const titleEn = typeof item.titleEn === "string" ? item.titleEn.trim() : "";
    const sortOrder = Number(item.sortOrder);
    if (!titleUa || !titleEn) errors.push(`${id}: titles are required`);
    if (titleUa.length > MAX_TITLE_LENGTH || titleEn.length > MAX_TITLE_LENGTH) {
      errors.push(`${id}: title is too long`);
    }
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100_000) {
      errors.push(`${id}: sortOrder must be an integer`);
    }
    data.push({
      id: id as ShopStockCategoryGroupId,
      titleUa,
      titleEn,
      sortOrder,
      isPublished: item.isPublished !== false,
    });
  }
  const owners = new Map<string, string>();
  for (const group of mergeShopCategoryGroupSettings(data)) {
    for (const title of [group.titleUa, group.titleEn]) {
      const key = normalizeShopSearchText(title);
      const owner = owners.get(key);
      if (owner && owner !== group.id) {
        errors.push(`${group.id}: title "${title}" is already used by ${owner}`);
      } else {
        owners.set(key, group.id);
      }
    }
  }
  return { data, errors };
}

type FacetItem = { key: string; label: string; count: number };

/** Applies editor labels, visibility and order to the category facet. */
export function applyShopCategoryGroupSettingsToFacet<T extends FacetItem>(
  items: T[],
  settings: ShopCategoryGroupSetting[],
  locale: string
): T[] {
  const byId = new Map<string, ShopCategoryGroupSetting>(settings.map((item) => [item.id, item]));
  return items
    .filter((item) => byId.get(item.key)?.isPublished !== false)
    .map((item) => {
      const setting = byId.get(item.key);
      return setting ? { ...item, label: locale === "en" ? setting.titleEn : setting.titleUa } : item;
    })
    .sort((left, right) => {
      const leftOrder = byId.get(left.key)?.sortOrder ?? 5_000;
      const rightOrder = byId.get(right.key)?.sortOrder ?? 5_000;
      return leftOrder - rightOrder || right.count - left.count;
    });
}

/**
 * Maps an editor-renamed group title back to its stable id, so a facet label sent
 * back as the `category` filter keeps resolving after a rename. Returns null when
 * the value is not a configured title.
 */
export function resolveShopCategoryGroupIdFromSettings(
  value: string | null | undefined,
  settings: ShopCategoryGroupSetting[]
): ShopStockCategoryGroupId | null {
  const needle = normalizeShopSearchText(value ?? "");
  if (!needle) return null;
  for (const setting of settings) {
    if (
      normalizeShopSearchText(setting.titleUa) === needle ||
      normalizeShopSearchText(setting.titleEn) === needle
    ) {
      return setting.id;
    }
  }
  return null;
}
