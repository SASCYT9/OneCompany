import { prisma } from "@/lib/prisma";
import {
  mergeShopCategoryGroupSettings,
  type ShopCategoryGroupSetting,
} from "@/lib/shopCategoryGroupSettings";

const SETTINGS_TTL_MS = 60_000;
let cache: { value: Promise<ShopCategoryGroupSetting[]>; expiresAt: number } | null = null;

export function invalidateShopCategoryGroupSettings() {
  cache = null;
}

/** Cached for a minute; a read failure falls back to the code defaults. */
export function loadShopCategoryGroupSettings(): Promise<ShopCategoryGroupSetting[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  const value = prisma.shopCategoryGroup
    .findMany()
    .then((rows) => mergeShopCategoryGroupSettings(rows))
    .catch(() => mergeShopCategoryGroupSettings([]));
  cache = { value, expiresAt: now + SETTINGS_TTL_MS };
  return value;
}
