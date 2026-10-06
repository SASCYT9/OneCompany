import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { after, NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  getOrCreateShopSettings,
  normalizeShopSettingsPayload,
  normalizeShopCurrencyRates,
  serializeShopSettings,
} from "@/lib/shopAdminSettings";
import { prisma } from "@/lib/prisma";
import { coordinateShopCatalogGlobalMutationWithClient } from "@/lib/shopCatalogGlobalMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import { assertShopPriceSourcesReady } from "@/lib/shopPriceSourceReadiness.server";
import { isShopSourcePriceBook } from "@/lib/shopPriceBookCurrency";

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    const settings = await getOrCreateShopSettings(prisma);
    return NextResponse.json(serializeShopSettings(settings));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop settings get", error);
    return NextResponse.json({ error: "Failed to load shop settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const body = await request.json().catch(() => ({}));
    const payload = normalizeShopSettingsPayload(body);

    const mutation = await coordinateShopCatalogGlobalMutationWithClient(prisma, {
      publications: [
        {
          entityType: "PRICE_BOOK",
          entityId: "public-shop-price-book",
          changeDomains: ["PRICE", "SETTINGS"],
        },
        {
          entityType: "SETTINGS",
          entityId: "public-shop-settings",
          changeDomains: ["SETTINGS"],
        },
      ],
      mutate: async (tx) => {
        const previousSettings = await tx.shopSettings.findUnique({ where: { key: "shop" } });
        const previousRates = normalizeShopCurrencyRates(previousSettings?.currencyRates);
        let currencyRatesToSave = payload.currencyRates as Prisma.InputJsonValue;
        if (previousRates._uahReserve !== 1 && payload.currencyRates._uahReserve === 1)
          throw new Error("NBU_ACTIVATION_REQUIRED");
        if (isShopSourcePriceBook(previousRates)) {
          const incomingRates = normalizeShopCurrencyRates(payload.currencyRates);
          const manualChange = (["EUR", "USD", "UAH"] as const).some(
            (key) => incomingRates[key] !== previousRates[key]
          );
          if (previousRates._uahReserve === 1 && manualChange)
            throw new Error("MANAGED_NBU_RATE_EDIT_BLOCKED");
          payload.currencyRates = {
            ...payload.currencyRates,
            _uahReserve: previousRates._uahReserve!,
            ...(previousRates._manualCross === 1 ? { _manualCross: 1 } : {}),
            _rawUsdToUah:
              previousRates._manualCross === 1
                ? (incomingRates._rawUsdToUah ??
                  previousRates._rawUsdToUah ??
                  incomingRates.UAH / incomingRates.USD)
                : manualChange
                  ? incomingRates.UAH / incomingRates.USD
                  : (previousRates._rawUsdToUah ?? incomingRates.UAH / incomingRates.USD),
          };
          currencyRatesToSave = {
            ...(previousSettings?.currencyRates as Prisma.InputJsonObject),
            ...payload.currencyRates,
          };
        }
        if (isShopSourcePriceBook(payload.currencyRates)) await assertShopPriceSourcesReady(tx);
        const settings = await tx.shopSettings.upsert({
          where: { key: "shop" },
          create: {
            key: "shop",
            b2bVisibilityMode: payload.b2bVisibilityMode,
            defaultB2bDiscountPercent: payload.defaultB2bDiscountPercent,
            defaultCurrency: payload.defaultCurrency,
            enabledCurrencies: payload.enabledCurrencies,
            currencyRates: currencyRatesToSave,
            shippingZones: payload.shippingZones as Prisma.InputJsonValue,
            taxRegions: payload.taxRegions as Prisma.InputJsonValue,
            regionalPricingRules: payload.regionalPricingRules as Prisma.InputJsonValue,
            brandShippingRules: payload.brandShippingRules as Prisma.InputJsonValue,
            orderNotificationEmail: payload.orderNotificationEmail,
            b2bNotes: payload.b2bNotes,
            showTaxesIncludedNotice: payload.showTaxesIncludedNotice,
            fopCompanyName: payload.fopCompanyName,
            fopIban: payload.fopIban,
            fopBankName: payload.fopBankName,
            fopEdrpou: payload.fopEdrpou,
            fopDetails: payload.fopDetails,
            whiteBitEnabled: payload.whiteBitEnabled,
          },
          update: {
            b2bVisibilityMode: payload.b2bVisibilityMode,
            defaultB2bDiscountPercent: payload.defaultB2bDiscountPercent,
            defaultCurrency: payload.defaultCurrency,
            enabledCurrencies: payload.enabledCurrencies,
            currencyRates: currencyRatesToSave,
            shippingZones: payload.shippingZones as Prisma.InputJsonValue,
            taxRegions: payload.taxRegions as Prisma.InputJsonValue,
            regionalPricingRules: payload.regionalPricingRules as Prisma.InputJsonValue,
            brandShippingRules: payload.brandShippingRules as Prisma.InputJsonValue,
            orderNotificationEmail: payload.orderNotificationEmail,
            b2bNotes: payload.b2bNotes,
            showTaxesIncludedNotice: payload.showTaxesIncludedNotice,
            fopCompanyName: payload.fopCompanyName,
            fopIban: payload.fopIban,
            fopBankName: payload.fopBankName,
            fopEdrpou: payload.fopEdrpou,
            fopDetails: payload.fopDetails,
            whiteBitEnabled: payload.whiteBitEnabled,
          },
        });
        await writeAdminAuditLog(tx, session, {
          scope: "shop",
          action: "settings.update",
          entityType: "shop.settings",
          entityId: settings.key,
          metadata: {
            b2bVisibilityMode: settings.b2bVisibilityMode,
            defaultB2bDiscountPercent:
              settings.defaultB2bDiscountPercent != null
                ? Number(settings.defaultB2bDiscountPercent)
                : null,
            defaultCurrency: settings.defaultCurrency,
            enabledCurrencies: settings.enabledCurrencies,
          },
        });
        return settings;
      },
    });
    const settings = mutation.value;

    revalidateTag("shop-settings", "max");
    after(async () => {
      try {
        await runShopCatalogOutboxRuntime({
          workerId: `settings-admin:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          limit: 10,
        });
      } catch (error) {
        console.error(
          "[shop-settings] immediate publication failed; cron recovery remains active",
          {
            outboxIds: mutation.publications.map((entry) => entry.outboxId),
            error,
          }
        );
      }
    });

    return NextResponse.json({
      ...serializeShopSettings(settings),
      catalogPublication: mutation.publications,
    });
  } catch (error) {
    if ((error as Error).message === "NBU_ACTIVATION_REQUIRED")
      return NextResponse.json(
        { error: "Активуйте правило курсів через кнопку НБУ після перевірки джерел цін." },
        { status: 409 }
      );
    if ((error as Error).message.startsWith("SHOP_PRICE_SOURCE_REQUIRED"))
      return NextResponse.json(
        {
          error: "Потрібні підтверджені вихідні валюти всіх цін.",
          code: "SHOP_PRICE_SOURCE_REQUIRED",
        },
        { status: 409 }
      );
    if ((error as Error).message === "MANAGED_NBU_RATE_EDIT_BLOCKED")
      return NextResponse.json(
        { error: "У режимі НБУ оновлюйте курси кнопкою НБУ, щоб зберегти кроскурс." },
        { status: 409 }
      );
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop settings update", error);
    return NextResponse.json({ error: "Failed to update shop settings" }, { status: 500 });
  }
}
