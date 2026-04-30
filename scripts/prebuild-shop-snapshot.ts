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
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const OUTPUT = path.join(process.cwd(), 'data', 'shop-settings.snapshot.json');

async function main() {
  const prisma = new PrismaClient();
  try {
    const settings = await prisma.shopSettings.findUnique({ where: { key: 'shop' } });
    if (!settings) {
      console.warn('[prebuild-shop-snapshot] no shop settings row found — skipping snapshot');
      return;
    }
    fs.writeFileSync(OUTPUT, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`[prebuild-shop-snapshot] wrote ${path.relative(process.cwd(), OUTPUT)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.warn('[prebuild-shop-snapshot] failed (build will continue):', err?.message || err);
  // Exit 0 so the build is never blocked by snapshot failure.
  process.exit(0);
});
