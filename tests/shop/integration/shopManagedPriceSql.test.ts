import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildShopCatalogEffectivePriceContext,
  buildShopCatalogEffectivePriceSql,
} from "../../../src/lib/shopCatalogEffectivePrice.server";
import { buildShopSettingsRuntimeFromPayload } from "../../../src/lib/shopAdminSettings";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
} from "../../../src/lib/shopPricingAudience";
import { expandShopPrices } from "../../../src/lib/shopPriceConversion";
import { wheelForceSetMoney } from "../../../src/lib/wheelforceFamily";
import type { ShopProduct } from "../../../src/lib/shopCatalog";

const url = process.env.MONOBANK_TEST_DATABASE_URL;
test(
  "managed price SQL agrees with source-based B2C/B2B, wheel sets and included delivery on a disposable PostgreSQL",
  { skip: !url },
  async () => {
    const target = new URL(url!);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.startsWith("/monobank_test")
    );
    const db = new PrismaClient({ datasources: { db: { url } } });
    const ids: string[] = [];
    const rates = {
      EUR: 1,
      USD: 50.6975 / 44.8333,
      UAH: 50.6975,
      _rawUsdToUah: 44.8333,
      _uahReserve: 1,
    };
    const settings = buildShopSettingsRuntimeFromPayload({
      defaultCurrency: "EUR",
      enabledCurrencies: ["EUR", "USD", "UAH"],
      currencyRates: rates,
      b2bVisibilityMode: "approved_only",
      defaultB2bDiscountPercent: 5,
      shippingZones: [],
      taxRegions: [],
    } as never);
    const cases = [
      { brand: "Remus", source: "EUR" as const, price: { eur: 100, usd: 115.22, uah: 5300 } },
      { brand: "iPE exhaust", source: "USD" as const, price: { eur: 86.79, usd: 100, uah: 4600 } },
      { brand: "Fi EXHAUST", source: "UAH" as const, price: { eur: 0, usd: 0, uah: 1000 } },
      { brand: "AKRAPOVIC", source: "EUR" as const, price: { eur: 570, usd: 0, uah: 29640 } },
      {
        brand: "iPE exhaust",
        source: "USD" as const,
        price: { eur: 86.79, usd: 100, uah: 4600 },
        b2bPrice: { eur: 60, usd: 0, uah: 0 },
      },
      {
        brand: "WheelForce",
        source: "EUR" as const,
        price: { eur: 37.94, usd: 43.71, uah: 2010.82 },
        wheel: true,
      },
      {
        brand: "Revozport",
        source: "USD" as const,
        price: { eur: 0, usd: 100, uah: 0 },
        weight: 6,
      },
    ];
    try {
      for (const entry of cases) {
        const id = randomUUID();
        ids.push(id);
        await db.shopProduct.create({
          data: {
            id,
            slug: id,
            titleUa: id,
            titleEn: id,
            brand: entry.brand,
            priceSourceCurrency: entry.source,
            priceEur: entry.price.eur || null,
            priceUsd: entry.price.usd || null,
            priceUah: entry.price.uah || null,
            priceEurB2b: entry.b2bPrice?.eur || null,
            weight: entry.weight,
            tags: entry.wheel ? ["wheels"] : [],
            productType: entry.wheel ? "wheel" : null,
            isPublished: true,
            status: "ACTIVE",
          },
        });
        const product = {
          id,
          slug: id,
          brand: entry.brand,
          price: { ...entry.price, sourceCurrency: entry.source },
          b2bPrice: entry.b2bPrice,
          shippingPricingWeightKg: entry.weight,
        } as unknown as ShopProduct;
        for (const group of [null, "B2B_APPROVED"] as const) {
          const viewer = buildShopViewerPricingContext(
            settings,
            group,
            group != null,
            null,
            undefined,
            { priceCountry: "Ukraine" }
          );
          const pricing = resolveShopProductPricing(product, viewer);
          const unit = expandShopPrices(pricing.effectivePrice, settings.currencyRates);
          const expected = entry.wheel
            ? expandShopPrices(wheelForceSetMoney(unit), settings.currencyRates)
            : unit;
          for (const currency of ["EUR", "USD", "UAH"] as const) {
            const context = buildShopCatalogEffectivePriceContext({
              viewer,
              currency,
              currencyRates: settings.currencyRates,
            });
            const rows = await db.$queryRaw<Array<{ amount: Prisma.Decimal | null }>>(
              Prisma.sql`SELECT ${buildShopCatalogEffectivePriceSql(context)} amount FROM (VALUES (${id})) projection("productId")`
            );
            assert.ok(rows[0].amount != null);
            const actual = Number(rows[0].amount);
            const value = expected[currency.toLowerCase() as "eur" | "usd" | "uah"];
            const cents = value * 100;
            const rounded =
              Math.round(cents + Math.sign(cents) * Number.EPSILON * Math.max(1, Math.abs(cents))) /
              100;
            assert.ok(
              Math.abs(actual - rounded) < 0.000001,
              `${entry.brand}/${group}/${currency}: SQL=${actual}, JS=${rounded}`
            );
          }
        }
      }
      const unresolvedId = randomUUID();
      ids.push(unresolvedId);
      await db.shopProduct.create({
        data: {
          id: unresolvedId,
          slug: unresolvedId,
          titleUa: unresolvedId,
          titleEn: unresolvedId,
          brand: "Remus",
          priceEur: 100,
          priceUsd: 115.22,
          priceUah: 5300,
          isPublished: true,
          status: "ACTIVE",
        },
      });
      const unresolvedRates = {
        EUR: 1,
        USD: 50.6975 / 44.8333,
        UAH: 50.6975,
        _rawUsdToUah: 44.8333,
        _uahReserve: 1,
      };
      const unresolvedSettings = buildShopSettingsRuntimeFromPayload({
        defaultCurrency: "EUR",
        enabledCurrencies: ["EUR", "USD", "UAH"],
        currencyRates: unresolvedRates,
        b2bVisibilityMode: "approved_only",
        defaultB2bDiscountPercent: 5,
        shippingZones: [],
        taxRegions: [],
      } as never);
      const unresolvedViewer = buildShopViewerPricingContext(
        unresolvedSettings,
        null,
        false,
        null,
        undefined,
        { priceCountry: "Ukraine" }
      );
      const unresolvedContext = buildShopCatalogEffectivePriceContext({
        viewer: unresolvedViewer,
        currency: "UAH",
        currencyRates: unresolvedSettings.currencyRates,
      });
      const unresolvedRows = await db.$queryRaw<Array<{ amount: Prisma.Decimal | null }>>(
        Prisma.sql`SELECT ${buildShopCatalogEffectivePriceSql(unresolvedContext)} amount FROM (VALUES (${unresolvedId})) projection("productId")`
      );
      assert.equal(unresolvedRows[0].amount, null);
    } finally {
      await db.shopProduct.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
  }
);
