#!/usr/bin/env tsx
/*
 * Delete Brabus commission-only / custom-order products.
 *
 * Per the client: only retail-shippable parts should remain in the catalog.
 * Commission-only items (complete cars, engine swaps, full body kits, themed
 * style interiors, armoring, custom one-off pieces like the Starry Sky
 * fibre-optic headliner) cannot be ordered through the normal cart and must
 * be removed.
 *
 * Patterns recognised (case-insensitive, matched against titleEn + titleUa):
 *   - "engine rocket" / "engineered rocket" / "increased displacement engine"
 *     / "8.5L V12" — engine swaps
 *   - "brabus rocket 900" / "brabus rocket 1000" — complete-car commissions
 *   - "armored protection" / "certified vehicle armouring" / "invicto" —
 *     armoured vehicle programmes
 *   - "starry sky" — fibre-optic LED headliner (custom design per order)
 *   - "...style interior" — themed interior commissions (Black Ops, Black &
 *     Gold, Capetown, Deep Blue, Santorini, Shadow, Upper east side, …)
 *   - "masterpiece interior" — bespoke leather interior packages
 *   - "widestar carbon" — full carbon widebody conversions (NOT individual
 *     carbon pieces, which stay)
 *   - "adventure package" — complete G-Class makeovers
 *   - "glazed trim parts interior" — Rolls-Royce custom trim packages
 *   - "business partition wall" — chauffeur partition for limousines
 *
 * Usage:
 *   tsx scripts/delete-brabus-commission.ts          (dry-run — default)
 *   tsx scripts/delete-brabus-commission.ts --commit
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

/* Single regex covering all commission-only patterns we discussed.
   Tested against titleEn and titleUa concatenated. */
const COMMISSION = new RegExp([
  // Engines / power conversions
  'engine rocket',
  'engineered rocket',
  'increased displacement engine',
  '8\\.5l v12',
  // Complete cars
  'brabus rocket 900\\b',
  'brabus rocket 1000',
  // Armouring
  'armored protection',
  'certified vehicle armouring',
  '\\binvicto\\b',
  // Custom LED headliner
  'starry sky',
  // Themed full-interior commissions
  'style interior',
  '\\bmasterpiece interior',
  'capetown style',
  'santorini style',
  'shadow style interior',
  'upper east side',
  'deep blue style',
  'black ops style',
  'black\\s*&\\s*gold style',
  // Full body conversions
  'widestar carbon',
  'widestar package with',
  // Complete makeovers / one-offs
  'adventure package',
  'glazed trim parts interior',
  'business partition wall',
].join('|'), 'i');

async function main() {
  console.log('=== Delete Brabus commission-only products ===');
  console.log('Mode:', COMMIT ? 'COMMIT (writes)' : 'DRY RUN');

  const all = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'brabus', mode: 'insensitive' } },
    select: {
      id: true, sku: true, slug: true, titleEn: true, titleUa: true,
      priceEur: true, productCategory: true,
    },
  });

  const candidates = all.filter((p) => {
    const text = `${p.titleEn || ''} ${p.titleUa || ''}`;
    return COMMISSION.test(text);
  });

  console.log(`Total brabus: ${all.length}`);
  console.log(`Commission-only candidates: ${candidates.length}`);
  console.log('\nTo delete (sorted by price desc):');
  candidates
    .sort((a, b) => Number(b.priceEur || 0) - Number(a.priceEur || 0))
    .forEach((p) => {
      const price = Number(p.priceEur || 0).toLocaleString().padStart(10);
      console.log(`  €${price}  ${(p.sku || '').padEnd(20)}  ${(p.titleEn || p.titleUa || '').slice(0, 80)}`);
    });

  /* Backup */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `brabus-commission-${ts}.json`);
  const fullRows = await prisma.shopProduct.findMany({
    where: { id: { in: candidates.map((p) => p.id) } },
  });
  await fs.writeFile(backupPath, JSON.stringify(fullRows, null, 2), 'utf-8');
  console.log(`\nBackup written: ${backupPath} (${fullRows.length} rows)`);

  if (!COMMIT) {
    console.log('\n(dry-run) — pass --commit to delete.');
    return;
  }

  /* FK safety: bundles are non-cascade — abort if any reference these. */
  const bundleRefs = await (prisma as any).shopBundleItem
    .count({ where: { componentProductId: { in: candidates.map((p) => p.id) } } })
    .catch(() => 0);
  if (bundleRefs > 0) {
    console.log(`⚠ ${bundleRefs} bundle references found — aborting.`);
    return;
  }

  const result = await prisma.shopProduct.deleteMany({
    where: { id: { in: candidates.map((p) => p.id) } },
  });
  console.log(`\n✓ Deleted ${result.count} commission-only products.`);
}

main()
  .catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
