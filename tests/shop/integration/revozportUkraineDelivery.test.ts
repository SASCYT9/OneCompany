import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { getShopCatalogCardPricingByIds } from "../../../src/lib/shopCatalogCardPricing.server";
import { buildShopCatalogEffectivePriceContext, buildShopCatalogEffectivePriceSql } from "../../../src/lib/shopCatalogEffectivePrice.server";
import { buildShopViewerPricingContext, resolveShopProductPricing } from "../../../src/lib/shopPricingAudience";
import { buildShopSettingsRuntimeFromPayload } from "../../../src/lib/shopAdminSettings";
import { expandShopPrices } from "../../../src/lib/shopPriceConversion";
const url = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || process.env.DATABASE_URL !== url)) throw new Error("Disposable localhost database required");
const rates = { EUR: 1, USD: 1.152174, UAH: 53 };
const settings = buildShopSettingsRuntimeFromPayload({ currencyRates: rates, b2bVisibilityMode: "approved_only", defaultB2bDiscountPercent: 10 } as never);

test("SQL filters and ordering match Ukraine card prices with supplier quotes, weight, and B2B bands", { skip: !url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const prefix = `revozport-delivery-${Date.now()}`;
  const ids = ["quote", "weight", "explicit"].map((name) => `${prefix}-${name}`);
  let primaryError: unknown;
  try {
    for (const [index, id] of ids.entries()) await db.shopProduct.create({ data: {
      id, slug: id, titleUa: id, titleEn: id, brand: "Revozport", status: "ACTIVE", isPublished: true,
      priceUsd: 499, weight: index === 1 ? 2 : null, priceUsdB2b: index === 2 ? 400 : null,
      variants: { create: { isDefault: true, position: 1, priceUsd: 499 } },
      metafields: { create: [{ namespace: "revozport_logistics", key: "sea_shipping_usd", value: "49.00" }, ...(index === 0 ? [{ namespace: "revozport_logistics", key: "delivery_pricing_weight_kg", value: "5.489" }] : [])] },
    } });
    const cards = await getShopCatalogCardPricingByIds(ids);
    assert.equal(cards[0].shippingToUaUsd, 49);
    for (const country of ["UA", "DE"]) for (const group of [null, "B2B_APPROVED"] as const) {
      const viewer = buildShopViewerPricingContext(settings, group, group != null, null, undefined, { priceCountry: country });
      for (const currency of ["USD", "EUR", "UAH"] as const) {
        const context = buildShopCatalogEffectivePriceContext({ viewer, currency, currencyRates: rates });
        const rows = await db.$queryRaw<Array<{ productId: string; amount: Prisma.Decimal }>>(Prisma.sql`
          SELECT projection."productId", ${buildShopCatalogEffectivePriceSql(context)} AS "amount"
          FROM (VALUES ${Prisma.join(ids.map((id) => Prisma.sql`(${id})`))}) AS projection("productId")
        `);
        for (const row of rows) {
          const card = cards.find((card) => card.productId === row.productId)!;
          const expected = expandShopPrices(resolveShopProductPricing(card as never, viewer).effectivePrice, rates)[currency.toLowerCase() as "usd" | "eur" | "uah"];
          assert.ok(Math.abs(Number(row.amount) - expected) < 0.01, `${country}/${group}/${currency}/${row.productId}: ${row.amount} vs ${expected}`);
        }
      }
    }
  } catch (error) { primaryError = error; throw error; } finally {
    try {
    await db.shopProductMetafield.deleteMany({ where: { productId: { in: ids } } });
    await db.shopProductVariant.deleteMany({ where: { productId: { in: ids } } });
    await db.shopKnowledgeOutbox.deleteMany({ where: { productId: { in: ids } } });
    await db.shopProduct.deleteMany({ where: { id: { in: ids } } });
    } catch (error) { if (primaryError == null) throw error; }
    await db.$disconnect();
  }
});
