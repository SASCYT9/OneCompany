/**
 * Build-time snapshot of shop settings.
 *
 * Vercel's static prerender pass spawns multiple worker processes that each
 * load `[locale]/layout.tsx` and many shop pages — every one of those calls
 * `getOrCreateShopSettings(prisma)`. With Vercel Postgres' restricted
 * `prisma_migration` role connection ceiling, this triggers a "too many
 * database connections" storm.
 *
 * This script runs once before `next build`, fetches the single
 * shop-settings row, and writes it to `data/shop-settings.snapshot.json`.
 * `getOrCreateShopSettings` consults the snapshot during
 * `phase-production-build` and returns it instead of opening a DB
 * connection. ISR/runtime calls bypass the snapshot and hit DB normally.
 *
 * Failure is non-fatal: if the snapshot can't be produced (DB down,
 * timeout, etc.) the build proceeds and pages fall back to the original
 * runtime DB path or the layout's hardcoded fallback.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const OUTPUT = path.join(process.cwd(), "data", "shop-settings.snapshot.json");

async function main() {
  const prisma = new PrismaClient();
  try {
    const [settings, productCount] = await Promise.all([
      prisma.shopSettings.findUnique({ where: { key: "shop" } }),
      prisma.shopProduct.count({ where: { isPublished: true } }),
    ]);

    if (!settings) {
      console.warn("[prebuild-shop-snapshot] no shop settings row found — skipping snapshot");
    } else {
      fs.writeFileSync(OUTPUT, JSON.stringify(settings, null, 2), "utf8");
      console.log(`[prebuild-shop-snapshot] wrote ${path.relative(process.cwd(), OUTPUT)}`);
    }

    console.log(
      `[prebuild-shop-snapshot] verified database contains ${productCount} published products`
    );
    if (productCount === 0) {
      throw new Error(
        "No published products found in database! Database might be empty or disconnected."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (isProd) {
    console.error(
      "[prebuild-shop-snapshot] CRITICAL BUILD ERROR (failing build):",
      err?.message || err
    );
    process.exit(1);
  } else {
    console.warn(
      "[prebuild-shop-snapshot] failed (dev/local build will continue):",
      err?.message || err
    );
    process.exit(0);
  }
});
