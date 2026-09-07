import assert from "node:assert/strict";
import test from "node:test";

import { Prisma, PrismaClient } from "@prisma/client";

import { getShopCatalogCardPricingByIds } from "../../../src/lib/shopCatalogCardPricing.server";
import {
  buildShopCatalogEffectivePriceContext,
  buildShopCatalogEffectivePriceSql,
} from "../../../src/lib/shopCatalogEffectivePrice.server";
import { buildShopSettingsRuntimeFromPayload } from "../../../src/lib/shopAdminSettings";
import { expandShopPrices } from "../../../src/lib/shopPriceConversion";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
} from "../../../src/lib/shopPricingAudience";

const url =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || process.env.DATABASE_URL !== url)
) {
  throw new Error(
    "Effective catalog price integration requires the same explicitly disposable localhost database"
  );
}

const rates: Record<"EUR" | "USD" | "UAH", number> = { EUR: 2, USD: 3, UAH: 120 };
const settings = buildShopSettingsRuntimeFromPayload({
  b2bVisibilityMode: "approved_only",
  defaultB2bDiscountPercent: 5,
  defaultCurrency: "EUR",
  enabledCurrencies: ["EUR", "USD", "UAH"],
  currencyRates: rates,
  shippingZones: [],
  taxRegions: [],
  orderNotificationEmail: null,
  b2bNotes: null,
} as never);

function expectedAmount(input: {
  card: Awaited<ReturnType<typeof getShopCatalogCardPricingByIds>>[number];
  viewer: ReturnType<typeof buildShopViewerPricingContext>;
  currency: "EUR" | "USD" | "UAH";
  currencyRates?: Record<"EUR" | "USD" | "UAH", number>;
}) {
  const effective = expandShopPrices(
    resolveShopProductPricing(input.card as never, input.viewer).effectivePrice,
    input.currencyRates ?? rates
  );
  const amount =
    input.currency === "EUR"
      ? effective.eur
      : input.currency === "UAH"
        ? effective.uah
        : effective.usd;
  return amount > 0 ? amount : null;
}

async function queryEffectiveAmounts(
  client: PrismaClient,
  ids: readonly string[],
  context: ReturnType<typeof buildShopCatalogEffectivePriceContext>
) {
  const values = Prisma.join(ids.map((id) => Prisma.sql`(${id})`));
  const rows = await client.$queryRaw<Array<{ productId: string; amount: Prisma.Decimal | null }>>(
    Prisma.sql`
      SELECT projection."productId", ${buildShopCatalogEffectivePriceSql(context)} AS "amount"
      FROM (VALUES ${values}) AS projection("productId")
      ORDER BY projection."productId" ASC
    `
  );
  return new Map(
    rows.map((row) => [row.productId, row.amount == null ? null : Number(row.amount)])
  );
}

test(
  "effective-price SQL matches fresh card pricing across B2C, Europe, and B2B contexts",
  { skip: !url },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url } } });
    const run = `effective-price-${Date.now()}`;
    const ids = ["variant", "zero", "conversion", "europe", "explicit", "discount", "unpriced"].map(
      (name) => `${run}-${name}`
    );
    let primaryError: unknown;
    try {
      await client.shopProduct.create({
        data: {
          id: ids[0],
          slug: ids[0],
          titleUa: ids[0],
          titleEn: ids[0],
          brand: "Variant Brand",
          isPublished: true,
          status: "ACTIVE",
          variants: {
            create: [
              { isDefault: true, position: 1, priceEur: 100, priceUsd: 120, priceUah: 4800 },
              { isDefault: false, position: 0, priceEur: 200, priceUsd: 240, priceUah: 9600 },
            ],
          },
        },
      });
      await client.shopProduct.create({
        data: {
          id: ids[1],
          slug: ids[1],
          titleUa: ids[1],
          titleEn: ids[1],
          brand: "Zero Brand",
          priceEur: 0,
          isPublished: true,
          status: "ACTIVE",
          variants: { create: { isDefault: true, position: 1, priceEur: 150, priceUsd: 120 } },
        },
      });
      await client.shopProduct.create({
        data: {
          id: ids[2],
          slug: ids[2],
          titleUa: ids[2],
          titleEn: ids[2],
          brand: "Conversion Brand",
          priceEur: 100,
          priceUsd: 150,
          isPublished: true,
          status: "ACTIVE",
        },
      });
      await client.shopProduct.create({
        data: {
          id: ids[3],
          slug: ids[3],
          titleUa: ids[3],
          titleEn: ids[3],
          brand: "Europe Brand",
          priceEur: 120,
          priceUsd: 144,
          priceUah: 5760,
          priceEurEurope: 100,
          isPublished: true,
          status: "ACTIVE",
        },
      });
      await client.shopProduct.create({
        data: {
          id: ids[4],
          slug: ids[4],
          titleUa: ids[4],
          titleEn: ids[4],
          brand: "Explicit Brand",
          priceEur: 100,
          priceUsd: 120,
          priceUah: 4800,
          priceEurB2b: 80,
          isPublished: true,
          status: "ACTIVE",
        },
      });
      await client.shopProduct.create({
        data: {
          id: ids[5],
          slug: ids[5],
          titleUa: ids[5],
          titleEn: ids[5],
          brand: "Discount Brand",
          priceEur: 10,
          priceUsd: 12,
          priceUah: 480,
          isPublished: true,
          status: "ACTIVE",
        },
      });
      await client.shopProduct.create({
        data: {
          id: ids[6],
          slug: ids[6],
          titleUa: ids[6],
          titleEn: ids[6],
          brand: "Unpriced Brand",
          priceEur: 0,
          priceUsd: 0,
          priceUah: 0,
          isPublished: true,
          status: "ACTIVE",
        },
      });

      const cards = await getShopCatalogCardPricingByIds(ids);
      const contexts = [
        {
          viewer: buildShopViewerPricingContext(settings, null, false, null, undefined, {
            priceCountry: "Ukraine",
          }),
          currency: "USD" as const,
        },
        {
          viewer: buildShopViewerPricingContext(settings, null, false, null, undefined, {
            priceCountry: "Germany",
          }),
          currency: "UAH" as const,
        },
        {
          viewer: buildShopViewerPricingContext(
            settings,
            "B2B_APPROVED",
            true,
            10,
            {
              customerBrandDiscountMap: new Map([
                ["discount brand", 0.05],
                ["zero brand", 0],
              ]),
              systemBrandDiscountMap: new Map([
                ["discount brand", 15],
                ["variant brand", 15],
                ["zero brand", 20],
              ]),
            },
            { priceCountry: "Germany" }
          ),
          currency: "EUR" as const,
        },
        {
          viewer: buildShopViewerPricingContext(settings, "B2B_APPROVED", true, null, undefined, {
            priceCountry: "Ukraine",
          }),
          currency: "EUR" as const,
        },
      ];

      for (const { viewer, currency } of contexts) {
        const actual = await queryEffectiveAmounts(
          client,
          ids,
          buildShopCatalogEffectivePriceContext({ viewer, currency, currencyRates: rates })
        );
        for (const card of cards) {
          assert.equal(
            actual.get(card.productId),
            expectedAmount({ card, viewer, currency, currencyRates: rates }),
            `${currency} ${card.productId} must match card pricing`
          );
        }
      }

      // Product EUR zero cannot borrow the default variant EUR; it can only be
      // converted from its separately inherited USD value, as the card path does.
      const zeroAmount = await queryEffectiveAmounts(
        client,
        [ids[1]],
        buildShopCatalogEffectivePriceContext({
          viewer: buildShopViewerPricingContext(settings, null, false),
          currency: "EUR",
          currencyRates: rates,
        })
      );
      assert.equal(zeroAmount.get(ids[1]), 80);
      const invalidRateContext: Record<"EUR" | "USD" | "UAH", number> = {
        EUR: 0,
        USD: 3,
        UAH: 120,
      };
      const invalidRateAmount = await queryEffectiveAmounts(
        client,
        [ids[1]],
        buildShopCatalogEffectivePriceContext({
          viewer: buildShopViewerPricingContext(settings, null, false),
          currency: "EUR",
          currencyRates: invalidRateContext,
        })
      );
      const zeroCard = cards.find((card) => card.productId === ids[1]);
      assert.ok(zeroCard);
      assert.equal(
        invalidRateAmount.get(ids[1]),
        expectedAmount({
          card: zeroCard,
          viewer: buildShopViewerPricingContext(settings, null, false),
          currency: "EUR",
          currencyRates: invalidRateContext,
        })
      );
      assert.equal(invalidRateAmount.get(ids[1]), null);
      const unpricedAmount = await queryEffectiveAmounts(
        client,
        [ids[6]],
        buildShopCatalogEffectivePriceContext({
          viewer: buildShopViewerPricingContext(settings, null, false),
          currency: "USD",
          currencyRates: rates,
        })
      );
      assert.equal(unpricedAmount.get(ids[6]), null);
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        // Product writes enqueue knowledge work in this schema. Delete only
        // this fixture's rows before its products, never shared outbox work.
        await client.shopProductVariant.deleteMany({ where: { productId: { in: ids } } });
        await client.shopKnowledgeOutbox.deleteMany({ where: { productId: { in: ids } } });
        await client.shopProduct.deleteMany({ where: { id: { in: ids } } });
      } catch (cleanupError) {
        // The original differential failure is the useful diagnostic; cleanup
        // must not replace it with a foreign-key error.
        if (primaryError == null) throw cleanupError;
      } finally {
        try {
          await client.$disconnect();
        } catch (disconnectError) {
          if (primaryError == null) throw disconnectError;
        }
      }
    }
  }
);
