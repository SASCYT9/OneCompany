import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { fetchShopCurrencyRatesFromNbu } from "@/lib/shopCurrencyNbu";
import { getOrCreateShopSettings, serializeShopSettings } from "@/lib/shopAdminSettings";
import { prisma } from "@/lib/prisma";
import { coordinateShopCatalogGlobalMutationWithClient } from "@/lib/shopCatalogGlobalMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const nbuRates = await fetchShopCurrencyRatesFromNbu();
    const currentSettings = await getOrCreateShopSettings(prisma);
    const mutation = await coordinateShopCatalogGlobalMutationWithClient(prisma, {
      publications: [
        {
          entityType: "PRICE_BOOK",
          entityId: "public-shop-price-book",
          changeDomains: ["PRICE", "SETTINGS"],
        },
      ],
      mutate: async (tx) => {
        const settings = await tx.shopSettings.update({
          where: { key: currentSettings.key },
          data: {
            currencyRates: nbuRates.currencyRates as Prisma.InputJsonValue,
          },
        });
        await writeAdminAuditLog(tx, session, {
          scope: "shop",
          action: "settings.currency_rates.refresh_nbu",
          entityType: "shop.settings",
          entityId: settings.key,
          metadata: {
            source: nbuRates.source,
            exchangedAt: nbuRates.exchangedAt,
            eurToUah: nbuRates.eurToUah,
            usdToUah: nbuRates.usdToUah,
            usdPerEur: nbuRates.usdPerEur,
            usdSpecial: nbuRates.usdSpecial,
          },
        });
        return settings;
      },
    });
    revalidateTag("shop-settings", "max");
    after(async () => {
      try {
        await runShopCatalogOutboxRuntime({
          workerId: `settings-nbu:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          limit: 10,
        });
      } catch (error) {
        console.error(
          "[shop-settings.nbu] immediate publication failed; cron recovery remains active",
          {
            outboxIds: mutation.publications.map((entry) => entry.outboxId),
            error,
          }
        );
      }
    });

    return NextResponse.json({
      settings: serializeShopSettings(mutation.value),
      nbu: nbuRates,
      catalogPublication: mutation.publications,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop settings NBU refresh", error);
    return NextResponse.json({ error: "Не вдалося оновити курси з НБУ" }, { status: 500 });
  }
}
