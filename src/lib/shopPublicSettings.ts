import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateShopSettings,
  getShopSettingsRuntime,
  type ShopSettingsRuntime,
} from "@/lib/shopAdminSettings";

const readPublicShopSettings = unstable_cache(
  async () => getShopSettingsRuntime(await getOrCreateShopSettings(prisma)),
  ["public-shop-settings-runtime"],
  { revalidate: 86400, tags: ["shop-settings"] }
);

// Last successfully read value in this server instance. Product pages await
// the settings on every render; when the cache is cold and the database pool
// is exhausted (P2024) or unreachable (P1001) the read throws and the PDP
// answers 5xx, which Google reports as "server error". Serving the last known
// settings keeps the page up instead; with nothing cached yet it still throws.
let lastKnownSettings: ShopSettingsRuntime | null = null;

export async function getPublicShopSettingsRuntime(): Promise<ShopSettingsRuntime> {
  try {
    const settings = await readPublicShopSettings();
    lastKnownSettings = settings;
    return settings;
  } catch (error) {
    if (lastKnownSettings) {
      console.warn(
        "[shop-settings] using last known settings after read failure:",
        error instanceof Error ? error.message : error
      );
      return lastKnownSettings;
    }
    throw error;
  }
}
