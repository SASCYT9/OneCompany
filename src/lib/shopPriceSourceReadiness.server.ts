import { isShopSourcePriceBook } from "./shopPriceBookCurrency";
import { Prisma, type PrismaClient } from "@prisma/client";

const bands = [
  ["priceSourceCurrency", "priceEur", "priceUsd", "priceUah"],
  ["compareAtSourceCurrency", "compareAtEur", "compareAtUsd", "compareAtUah"],
  ["b2bPriceSourceCurrency", "priceEurB2b", "priceUsdB2b", "priceUahB2b"],
  ["b2bCompareAtSourceCurrency", "compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"],
] as const;

/** Validate every published price band and variant before activating a managed price book. */
export async function shopPriceSourceReadiness(
  db: PrismaClient | Prisma.TransactionClient,
  productId?: string
) {
  const missing = (table: string) =>
    bands.map(([source, eur, usd, uah]) => {
      const value = (field: string) => Prisma.raw(`${table}."${field}"`);
      return Prisma.sql`SELECT ${table}::text "entityType", ${value("id")} id, ${source}::text band
      FROM ${Prisma.raw(`"${table}"`)} ${Prisma.raw(table)}
      ${table === "ShopProductVariant" ? Prisma.sql`JOIN "ShopProduct" product ON product.id = ${value("productId")}` : Prisma.empty}
      WHERE ${Prisma.raw(table === "ShopProduct" ? table : "product")}."isPublished" = true
        ${productId ? Prisma.sql`AND ${Prisma.raw(table === "ShopProduct" ? table : "product")}.id = ${productId}` : Prisma.empty}
        AND ${Prisma.raw(table === "ShopProduct" ? table : "product")}.status = 'ACTIVE'
        AND (CASE WHEN COALESCE(${value(eur)},0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(${value(usd)},0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(${value(uah)},0)>0 THEN 1 ELSE 0 END) > 0
        AND CASE ${value(source)} WHEN 'EUR' THEN COALESCE(${value(eur)},0)<=0 WHEN 'USD' THEN COALESCE(${value(usd)},0)<=0 WHEN 'UAH' THEN COALESCE(${value(uah)},0)<=0
          ELSE (CASE WHEN COALESCE(${value(eur)},0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(${value(usd)},0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(${value(uah)},0)>0 THEN 1 ELSE 0 END)>1 END`;
    });
  const parts = [...missing("ShopProduct"), ...missing("ShopProductVariant")];
  const rows = await db.$queryRaw<Array<{ entityType: string; id: string; band: string }>>(
    Prisma.sql`${Prisma.join(parts, " UNION ALL ")}`
  );
  return { ready: rows.length === 0, unresolvedBands: rows.length, examples: rows.slice(0, 20) };
}

export async function assertShopPriceSourcesReady(db: PrismaClient | Prisma.TransactionClient) {
  const report = await shopPriceSourceReadiness(db);
  if (!report.ready) throw new Error(`SHOP_PRICE_SOURCE_REQUIRED:${report.unresolvedBands}`);
  return report;
}

export async function assertManagedShopProductSourcesReady(
  tx: Prisma.TransactionClient,
  productId: string
) {
  const settings = await tx.shopSettings.findUnique({
    where: { key: "shop" },
    select: { currencyRates: true },
  });
  const rates = settings?.currencyRates as Record<string, unknown> | null | undefined;
  if (!isShopSourcePriceBook(rates)) return;
  const report = await shopPriceSourceReadiness(tx, productId);
  if (!report.ready) throw new Error(`SHOP_PRICE_SOURCE_REQUIRED:${report.unresolvedBands}`);
}
