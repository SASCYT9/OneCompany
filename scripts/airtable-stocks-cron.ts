/**
 * Airtable → DB stock sync (formerly /api/admin/cron/airtable-stocks).
 *
 * Pulls latest stock counts from Airtable and bulk-updates inventoryQty
 * on matching ShopProductVariant rows by SKU. Migrated off Vercel Cron
 * to save function-compute spend.
 *
 * Run via .github/workflows/airtable-stocks-cron.yml (hourly).
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { fetchAirtableProductsWithStocks } from "../src/lib/airtable";

dotenv.config({ path: ".env.local" });
const prisma = new PrismaClient();

async function run() {
  console.log("[Airtable Sync] Fetching products with stocks from Airtable...");
  const airtableProducts = await fetchAirtableProductsWithStocks();
  console.log(`[Airtable Sync] Fetched ${airtableProducts.length} items.`);

  let updatedCount = 0;
  for (const item of airtableProducts) {
    if (!item.sku) continue;
    const res = await prisma.shopProductVariant.updateMany({
      where: { sku: item.sku },
      data: { inventoryQty: item.quantity },
    });
    if (res.count > 0) {
      updatedCount += res.count;
    }
  }

  console.log(
    `[Airtable Sync] Done. Scanned: ${airtableProducts.length}, Updated: ${updatedCount}.`
  );
}

run()
  .catch((error) => {
    console.error("[Airtable Sync] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
