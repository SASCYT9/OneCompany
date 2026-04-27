#!/usr/bin/env tsx
/*
 * Delete Brabus phantom products.
 *
 * These are scrape leftovers from brabus.com category-index pages — not real
 * sellable products. They have €0 price plus titles like "Tuning based on
 * G-Class W 465" or vehicle-codes-as-titles ("Porsche Taycan"). They show up
 * nowhere on the live brabus.com product catalog.
 *
 * Usage:
 *   tsx scripts/delete-brabus-phantoms.ts            (dry-run)
 *   tsx scripts/delete-brabus-phantoms.ts --commit
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

/* Detect a phantom: €0 price + title shape that matches a category-index page,
   not a real product. */
const PLACEHOLDER_TITLE = /(tuning based on|tuning for|brabus based on porsche|^[a-z]?[a-z]?-?\d?\s*$|^masterpiece interior$|^sport valve exhaust system$|^starry sky)/i;
const GENERIC_NO_VEHICLE = /^(porsche taycan|porsche 911 turbo|brabus starry sky)$/i;

async function main() {
  console.log('=== Delete Brabus phantoms ===');
  console.log('Mode:', COMMIT ? 'COMMIT (writes)' : 'DRY RUN');

  const all = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'brabus', mode: 'insensitive' } },
    select: {
      id: true, sku: true, slug: true, titleEn: true, titleUa: true,
      priceEur: true, image: true, productCategory: true,
    },
  });

  const phantoms = all.filter((p) => {
    const eur = Number(p.priceEur || 0);
    if (eur > 0) return false;
    const t = (p.titleEn || p.titleUa || '').trim();
    return PLACEHOLDER_TITLE.test(t) || GENERIC_NO_VEHICLE.test(t);
  });

  console.log(`Total brabus products: ${all.length}`);
  console.log(`Phantoms identified: ${phantoms.length}`);
  console.log('\nList:');
  phantoms.forEach((p) => {
    console.log(`  ${(p.sku || '').padEnd(22)} €${p.priceEur || 0}  | ${(p.titleEn || p.titleUa || '').slice(0, 70)}`);
  });

  /* Backup */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `brabus-phantoms-${ts}.json`);
  const fullRows = await prisma.shopProduct.findMany({
    where: { id: { in: phantoms.map((p) => p.id) } },
  });
  await fs.writeFile(backupPath, JSON.stringify(fullRows, null, 2), 'utf-8');
  console.log(`\nBackup written: ${backupPath} (${fullRows.length} rows)`);

  if (!COMMIT) {
    console.log('\n(dry-run) — pass --commit to delete.');
    return;
  }

  /* Cascade should clean related rows. Bundles are non-cascade — pre-check. */
  const bundleRefs = await (prisma as any).shopBundleItem
    .count({ where: { componentProductId: { in: phantoms.map((p) => p.id) } } })
    .catch(() => 0);
  if (bundleRefs > 0) {
    console.log(`⚠ ${bundleRefs} bundle references found — aborting to be safe.`);
    return;
  }

  const result = await prisma.shopProduct.deleteMany({
    where: { id: { in: phantoms.map((p) => p.id) } },
  });
  console.log(`\n✓ Deleted ${result.count} phantom products.`);
}

main()
  .catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
