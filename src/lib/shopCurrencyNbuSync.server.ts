import type { PrismaClient } from "@prisma/client";
import type { AdminSession } from "@/lib/adminAuth";
import { writeAdminAuditLog } from "@/lib/adminRbac";
import { fetchShopCurrencyRatesFromNbu } from "@/lib/shopCurrencyNbu";
import { getOrCreateShopSettings } from "@/lib/shopAdminSettings";
import { coordinateShopCatalogGlobalMutationWithClient } from "@/lib/shopCatalogGlobalMutationCoordinator.server";
import { assertShopPriceSourcesReady } from "./shopPriceSourceReadiness.server";
import { isManualShopPriceBook } from "./shopPriceBookCurrency";

export async function syncShopNbuCurrencyRates(
  prisma: PrismaClient,
  session?: AdminSession,
  dryRun = false
) {
  const current = await getOrCreateShopSettings(prisma);
  const previous = current.currencyRates as Record<string, unknown>;
  if (isManualShopPriceBook(previous))
    return {
      settings: current,
      nbu: null,
      changed: false,
      dryRun,
      publications: [],
      reason: "manual_rates_active",
    };
  const nbu = await fetchShopCurrencyRatesFromNbu();
  if (!dryRun) await assertShopPriceSourcesReady(prisma);
  const dateKey = (date: string) => {
    const match = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) throw new Error("Invalid NBU exchange date");
    const key = `${match[3]}-${match[2]}-${match[1]}`;
    const dateValue = new Date(`${key}T00:00:00Z`);
    if (!Number.isFinite(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== key)
      throw new Error("Invalid NBU exchange date");
    return key;
  };
  const nextDateKey = dateKey(nbu.exchangedAt);
  if (typeof previous._exchangedAt === "string" && nextDateKey < dateKey(previous._exchangedAt))
    throw new Error("NBU returned older rates; retain current rates");
  const unchanged =
    previous._exchangedAt === nbu.exchangedAt &&
    ["EUR", "USD", "UAH", "_uahReserve", "_rawUsdToUah", "_rawUsdPerEur"].every(
      (key) => previous[key] === nbu.currencyRates[key as keyof typeof nbu.currencyRates]
    );
  if (dryRun || unchanged)
    return { settings: current, nbu, changed: false, dryRun, publications: [] };
  const actor = session ?? {
    email: "currency-cron@system.local",
    name: "NBU daily currency sync",
    permissions: [],
    issuedAt: Date.now(),
    nonce: "system-cron",
  };
  const mutation = await coordinateShopCatalogGlobalMutationWithClient(prisma, {
    publications: [
      {
        entityType: "PRICE_BOOK",
        entityId: "public-shop-price-book",
        changeDomains: ["PRICE", "SETTINGS"],
      },
    ],
    mutate: async (tx) => {
      const latest = await tx.shopSettings.findUniqueOrThrow({ where: { key: current.key } });
      const latestRates = latest.currencyRates as Record<string, unknown>;
      if (isManualShopPriceBook(latestRates)) throw new Error("MANUAL_RATES_ACTIVE");
      await assertShopPriceSourcesReady(tx);
      if (
        typeof latestRates._exchangedAt === "string" &&
        nextDateKey < dateKey(latestRates._exchangedAt)
      )
        throw new Error("Newer rates already saved; retain current rates");
      const settings = await tx.shopSettings.update({
        where: { key: current.key },
        data: {
          currencyRates: {
            ...nbu.currencyRates,
            _source: "nbu",
            _exchangedAt: nbu.exchangedAt,
            _rounding: "uah_reserve_per_source_unit",
            _rawEurToUah: nbu.eurToUah,
            _rawUsdToUah: nbu.usdToUah,
          },
        },
      });
      await writeAdminAuditLog(tx, actor, {
        scope: "shop",
        action: "settings.currency_rates.refresh_nbu",
        entityType: "shop.settings",
        entityId: settings.key,
        metadata: {
          source: nbu.source,
          exchangedAt: nbu.exchangedAt,
          eurToUah: nbu.eurToUah,
          usdToUah: nbu.usdToUah,
          usdPerEur: nbu.usdPerEur,
          rawUsdPerEur: nbu.rawUsdPerEur,
          eurSaleToUah: nbu.eurToUah + 1,
          usdSaleToUah: nbu.usdToUah + 1,
          reserveUahPerForeignUnit: 1,
          usdSpecial: nbu.usdSpecial,
        },
      });
      return settings;
    },
  });
  return {
    settings: mutation.value,
    nbu,
    changed: true,
    dryRun: false,
    publications: mutation.publications,
  };
}
