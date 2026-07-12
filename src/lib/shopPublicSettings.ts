import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";

const readPublicShopSettings = unstable_cache(
  async () => getShopSettingsRuntime(await getOrCreateShopSettings(prisma)),
  ["public-shop-settings-runtime"],
  { revalidate: 86400, tags: ["shop-settings"] }
);

export function getPublicShopSettingsRuntime() {
  return readPublicShopSettings();
}
