import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  const models = [
    { name: "ShopProduct", countFn: () => prisma.shopProduct.count() },
    { name: "ShopProductVariant", countFn: () => prisma.shopProductVariant.count() },
    { name: "ShopProductMedia", countFn: () => prisma.shopProductMedia.count() },
    { name: "ShopProductMetafield", countFn: () => prisma.shopProductMetafield.count() },
    { name: "ShopInventoryLevel", countFn: () => prisma.shopInventoryLevel.count() },
    { name: "Turn14Item", countFn: () => prisma.turn14Item.count() },
    { name: "Turn14Fitment", countFn: () => prisma.turn14Fitment.count() },
    { name: "Turn14CatalogItem", countFn: () => prisma.turn14CatalogItem.count() },
    { name: "CrmCustomer", countFn: () => prisma.crmCustomer.count() },
    { name: "CrmOrder", countFn: () => prisma.crmOrder.count() },
    { name: "CrmOrderItem", countFn: () => prisma.crmOrderItem.count() },
    { name: "StockProduct", countFn: () => prisma.stockProduct.count() },
    { name: "TelegramUser", countFn: () => prisma.telegramUser.count() },
    { name: "TelegramConversation", countFn: () => prisma.telegramConversation.count() },
    { name: "Message", countFn: () => prisma.message.count() },
    { name: "AdminAuditLog", countFn: () => prisma.adminAuditLog.count() },
    { name: "ShopOrder", countFn: () => prisma.shopOrder.count() },
    { name: "ShopOrderItem", countFn: () => prisma.shopOrderItem.count() },
    { name: "ShopCustomer", countFn: () => prisma.shopCustomer.count() },
    { name: "ShopCart", countFn: () => prisma.shopCart.count() },
    { name: "ShopCartItem", countFn: () => prisma.shopCartItem.count() },
  ];

  console.log("--- Database Row Counts ---");
  for (const m of models) {
    try {
      const count = await m.countFn();
      console.log(`${m.name}: ${count}`);
    } catch (e: any) {
      console.log(`${m.name}: ERROR (${e.message})`);
    }
  }

  // Also query database size if supported by postgresql
  try {
    const dbSizeResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `);
    console.log(`Database Total Size: ${dbSizeResult[0]?.size}`);
  } catch (e: any) {
    console.log(`Database Size Query: Failed (${e.message})`);
  }

  // Query top tables by disk space
  try {
    console.log("\n--- Top 10 Tables by Disk Space ---");
    const tableSizes: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
        n_live_tup AS row_estimate
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 10;
    `);
    for (const t of tableSizes) {
      console.log(
        `Table: ${t.table_name} | Total: ${t.total_size} (Data: ${t.table_size}, Index: ${t.index_size}) | Rows: ${t.row_estimate}`
      );
    }
  } catch (e: any) {
    console.log(`Table Disk Space Query: Failed (${e.message})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
