/**
 * Airtable → DB stock sync (formerly /api/admin/cron/airtable-stocks).
 *
 * Pulls latest stock counts from Airtable and bulk-updates inventoryQty
 * on matching ShopProductVariant rows by SKU. Migrated off Vercel Cron
 * to save function-compute spend.
 *
 * Run via .github/workflows/airtable-stocks-cron.yml (currently monthly) or a
 * separately authorized manual dispatch.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { fetchAirtableProductsWithStocks } from "../src/lib/airtable";
import { syncAirtableStocksToCatalog } from "../src/lib/airtableStockCatalogSync.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";

dotenv.config({ path: ".env.local" });
const prisma = new PrismaClient();
const session = {
  email: "airtable-stock-cron@system.local",
  name: "Airtable stock cron",
  permissions: ["*"],
  issuedAt: 0,
  nonce: "airtable-stock-cron",
};

async function run() {
  console.log("[Airtable Sync] Fetching products with stocks from Airtable...");
  const airtableProducts = await fetchAirtableProductsWithStocks();
  console.log(`[Airtable Sync] Fetched ${airtableProducts.length} items.`);

  const result = await syncAirtableStocksToCatalog({ prisma, items: airtableProducts, session });
  const publication = await runShopCatalogOutboxRuntime({
    workerId: `catalog-airtable-stock-cli:${process.pid}`,
    limit: Math.min(50, Math.max(10, result.productsUpdated)),
  });

  console.log(
    `[Airtable Sync] Done. Scanned: ${result.scanned}, Updated: ${result.updated}, ` +
      `Products: ${result.productsUpdated}, Unmatched SKUs: ${result.unmatchedSkus}, ` +
      `Published: ${publication.completed}.`
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
