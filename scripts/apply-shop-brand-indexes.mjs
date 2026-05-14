#!/usr/bin/env node
/**
 * One-shot migration: adds `brand` and `vendor` B-tree indexes to
 * ShopProduct to back the `WHERE brand ILIKE … OR vendor ILIKE …` query
 * used by `getShopProductsByBrandServer`.
 *
 * Uses `CREATE INDEX CONCURRENTLY` so the table stays writable during the
 * build. Idempotent (`IF NOT EXISTS`) — safe to re-run.
 *
 * Run from repo root:
 *   node scripts/apply-shop-brand-indexes.mjs
 */
import { PrismaClient } from "@prisma/client";

const STATEMENTS = [
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "ShopProduct_brand_idx"  ON "ShopProduct" ("brand")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "ShopProduct_vendor_idx" ON "ShopProduct" ("vendor")',
];

const prisma = new PrismaClient();

async function main() {
  for (const sql of STATEMENTS) {
    const label = sql.match(/"ShopProduct_(\w+_idx)"/)?.[1] ?? sql;
    process.stdout.write(`→ ${label} … `);
    const started = Date.now();
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`ok (${Date.now() - started} ms)`);
    } catch (err) {
      console.log("FAIL");
      console.error(err);
      process.exitCode = 1;
    }
  }
}

main().finally(() => prisma.$disconnect());
