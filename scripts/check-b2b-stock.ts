/**
 * Diagnostic: how much stock is in DB for the B2B "Склад" page.
 * Counts: Turn14Item (cached distributor catalog) and StockProduct (other distributors).
 *
 * Read-only.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "../src/lib/prisma";

async function safeCount(label: string, fn: () => Promise<number>) {
  try {
    const c = await fn();
    console.log(`${label}: ${c}`);
    return c;
  } catch (e: any) {
    console.warn(`${label}: ERROR ${e?.meta?.code ?? ""} ${e?.meta?.message ?? e?.message ?? e}`);
    return null;
  }
}

async function main() {
  console.log("=== B2B Stock inventory ===");
  await safeCount("Turn14Item total", () => prisma.turn14Item.count());
  await safeCount("Turn14Item inStock=true", () =>
    prisma.turn14Item.count({ where: { inStock: true } })
  );
  await safeCount("StockProduct total", () => prisma.stockProduct.count());
  await safeCount("StockProduct inStock=true", () =>
    prisma.stockProduct.count({ where: { inStock: true } })
  );
  await safeCount("Turn14BrandMarkup", () => prisma.turn14BrandMarkup.count());
  await safeCount("ShopProduct total", () => prisma.shopProduct.count());
  await safeCount("ShopProductVariant total", () => prisma.shopProductVariant.count());
  await safeCount("ShopInventoryLevel total", () => prisma.shopInventoryLevel.count());
  await safeCount("ShopWarehouse total", () => prisma.shopWarehouse.count());
  await safeCount("ShopBrandLogistics total", () => prisma.shopBrandLogistics.count());

  console.log("\n=== Turn14 brand breakdown (top 20) ===");
  try {
    const brands = await prisma.$queryRaw<Array<{ brand: string; count: bigint }>>`
      SELECT COALESCE(brand,'(null)') AS brand, COUNT(*)::bigint AS count
      FROM "Turn14Item"
      GROUP BY brand
      ORDER BY count DESC
      LIMIT 20
    `;
    for (const b of brands) console.log(`  ${b.brand}: ${b.count}`);
  } catch (e) {
    console.warn("brand breakdown failed:", e);
  }

  console.log("\n=== StockProduct distributor breakdown ===");
  try {
    const ds = await prisma.$queryRaw<Array<{ distributor: string; count: bigint }>>`
      SELECT COALESCE(distributor,'(null)') AS distributor, COUNT(*)::bigint AS count
      FROM "StockProduct"
      GROUP BY distributor
      ORDER BY count DESC
    `;
    for (const d of ds) console.log(`  ${d.distributor}: ${d.count}`);
  } catch (e) {
    console.warn("distributor breakdown failed:", e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
