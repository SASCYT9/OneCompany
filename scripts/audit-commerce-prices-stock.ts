import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";

async function main() {
  const envPath = process.argv.find((arg) => arg.startsWith("--env-path="))?.slice(11);
  if (!envPath) throw new Error("Explicit env-path required; read-only audit");
  const env = parse(readFileSync(envPath));
  const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } });
  const rows: Array<Record<string, unknown>> = [];
  const counts = { products: 0, singleStoredCurrency: 0, multipleStoredCurrencies: 0, priceOnRequest: 0, compareRows: 0, nonDiscountCompareRows: 0, availabilityDateRows: 0 };
  try {
    let after: string | undefined;
    while (true) {
      const products = await prisma.shopProduct.findMany({ where: { isPublished: true, status: "ACTIVE", ...(after ? { id: { gt: after } } : {}) }, take: 500, orderBy: { id: "asc" }, select: { id: true, sku: true, slug: true, brand: true, priceEur: true, priceUsd: true, priceUah: true, compareAtEur: true, compareAtUsd: true, compareAtUah: true, priceEurEurope: true, stock: true, updatedAt: true, metafields: { where: { namespace: "onecompany", key: { in: ["availability_date", "price_base_currency"] } }, select: { key: true, value: true } }, variants: { where: { isDefault: true }, select: { sku: true, inventoryQty: true, priceEur: true, priceUsd: true, priceUah: true } } } });
      if (!products.length) break;
      for (const product of products) {
        const variant = product.variants[0];
        const money = [Number(product.priceEur ?? variant?.priceEur ?? 0), Number(product.priceUsd ?? variant?.priceUsd ?? 0), Number(product.priceUah ?? variant?.priceUah ?? 0)];
        const currencies = ["EUR", "USD", "UAH"].filter((_, index) => money[index] > 0);
        const compares = [Number(product.compareAtEur ?? 0), Number(product.compareAtUsd ?? 0), Number(product.compareAtUah ?? 0)];
        const invalidCompares = ["EUR", "USD", "UAH"].filter((_, index) => compares[index] > 0 && money[index] > 0 && compares[index] <= money[index]);
        counts.products++;
        if (currencies.length === 1) counts.singleStoredCurrency++;
        else if (currencies.length > 1) counts.multipleStoredCurrencies++;
        else counts.priceOnRequest++;
        if (compares.some((amount) => amount > 0)) counts.compareRows++;
        if (invalidCompares.length) counts.nonDiscountCompareRows++;
        const availabilityDate = product.metafields.find((field) => field.key === "availability_date")?.value ?? "";
        if (availabilityDate) counts.availabilityDateRows++;
        rows.push({ sku: product.sku ?? variant?.sku, slug: product.slug, brand: product.brand, stored_currencies: currencies.join("/"), explicit_base: product.metafields.find((field) => field.key === "price_base_currency")?.value ?? "", eur: money[0], usd: money[1], uah: money[2], compare_eur: compares[0], compare_usd: compares[1], compare_uah: compares[2], non_discount_compares: invalidCompares.join("/"), europe_price: Number(product.priceEurEurope ?? 0), stock_field: product.stock, default_variant_qty: variant?.inventoryQty ?? "", availability_date: availabilityDate, product_updated_at: product.updatedAt.toISOString() });
      }
      after = products.at(-1)!.id;
    }
    const settings = await prisma.shopSettings.findUnique({ where: { key: "shop" }, select: { currencyRates: true, defaultCurrency: true } });
    const directory = resolve("outputs/site-commerce-2026-10-03");
    mkdirSync(directory, { recursive: true });
    const columns = Object.keys(rows[0] ?? {});
    writeFileSync(resolve(directory, "price-stock-audit.csv"), columns.join(",") + "\n" + rows.map((row) => columns.map((column) => `"${String(row[column] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"));
    writeFileSync(resolve(directory, "price-stock-audit-summary.json"), JSON.stringify({ readAt: new Date().toISOString(), counts, settings, note: "Compare<=price is a raw-data review flag, not evidence that the current UI renders a false discount. InventoryQty is catalog evidence, not physical stock confirmation. Multiple currencies need provenance before automatic repricing." }, null, 2));
    console.log(JSON.stringify({ counts, settings }));
  } finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Audit failed"); process.exitCode = 1; });
