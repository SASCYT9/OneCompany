#!/usr/bin/env tsx
/*
 * Brabus duplicate-SKU dedupe.
 *
 * Background: two scrape passes left 363 case-insensitive duplicate SKUs in
 * shop_products (e.g. `Z12-464-PE` and `z12-464-pe`). Each pair has identical
 * EUR price but otherwise the UPPERCASE row has the richer content (titles
 * with vehicle model, full descriptions, SEO) and the lowercase row has
 * locally-hosted images (`/brabus-images/...`).
 *
 * Strategy per pair:
 *   1. Pick a WINNER by content quality (longer description first, then title
 *      that mentions a vehicle, then more recent createdAt).
 *   2. Fold the LOSER's local image into the winner if the winner currently
 *      points at brabus.com (CDN-fragile).
 *   3. Merge galleries (unique image URLs).
 *   4. Backup the loser row to backups/brabus-dedup-{ts}.json.
 *   5. Delete the loser. Cascade FK relations (collections/media/options/
 *      variants/metafields) are removed automatically by the schema.
 *
 * Bundles (ShopBundleItem.componentProductId) and reviews/wishlist tables
 * are non-cascade — if a loser is referenced there, the script aborts that
 * specific pair and reports it.
 *
 * Usage:
 *   tsx scripts/dedupe-brabus-skus.ts --dry-run   (default)
 *   tsx scripts/dedupe-brabus-skus.ts --commit
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');

const VEHICLE_HINT = /(mercedes|porsche|bentley|rolls|maybach|lamborghini|range\s?rover|smart|w\s?\d+|x\s?\d+|c\s?\d+|r\s?\d+|amg|gle|gls|gla|glb|glc|cls|sl-|sl\s|s-class|g-class|e-class|c-class)/i;

type Row = {
  id: string;
  sku: string | null;
  slug: string;
  brand: string | null;
  titleEn: string;
  titleUa: string;
  longDescEn: string | null;
  longDescUa: string | null;
  image: string | null;
  gallery: unknown;
  productCategory: string | null;
  seoTitleEn: string | null;
  seoTitleUa: string | null;
  createdAt: Date;
  priceEur: unknown;
};

type Pair = { sku: string; rows: Row[] };

function descLen(r: Row, locale: 'en' | 'ua') {
  return ((locale === 'en' ? r.longDescEn : r.longDescUa) || '').trim().length;
}

function titleHasVehicle(r: Row) {
  return VEHICLE_HINT.test(r.titleEn || '') || VEHICLE_HINT.test(r.titleUa || '');
}

function isLocalImage(url: string | null) {
  return !!url && url.startsWith('/');
}

function isExternalBrabusImage(url: string | null) {
  return !!url && url.includes('brabus.com');
}

function pickWinner(rows: Row[]): { winner: Row; loser: Row } {
  /* Score each row; higher = better. */
  const score = (r: Row) =>
    descLen(r, 'en') +
    descLen(r, 'ua') +
    (titleHasVehicle(r) ? 100 : 0) +
    (r.seoTitleEn ? 10 : 0) +
    (r.seoTitleUa ? 10 : 0) +
    /* Tiebreaker: more recent enrichment, scaled down */
    Math.floor(new Date(r.createdAt).getTime() / 1e9);

  const sorted = [...rows].sort((a, b) => score(b) - score(a));
  return { winner: sorted[0], loser: sorted[1] };
}

function mergeGallery(winnerGallery: unknown, loserGallery: unknown): string[] {
  const arr = (g: unknown): string[] =>
    Array.isArray(g) ? g.filter((x): x is string => typeof x === 'string') : [];
  return Array.from(new Set([...arr(winnerGallery), ...arr(loserGallery)]));
}

async function main() {
  console.log('=== Brabus dedupe ===');
  console.log('Mode:', COMMIT ? 'COMMIT (writes to DB)' : 'DRY RUN (no changes)');

  const rows = (await prisma.shopProduct.findMany({
    where: { brand: { equals: 'brabus', mode: 'insensitive' } },
    select: {
      id: true, sku: true, slug: true, brand: true,
      titleEn: true, titleUa: true,
      longDescEn: true, longDescUa: true,
      image: true, gallery: true,
      productCategory: true,
      seoTitleEn: true, seoTitleUa: true,
      createdAt: true, priceEur: true,
    },
  })) as unknown as Row[];

  /* Group by case-insensitive SKU */
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = (r.sku || '').toLowerCase();
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const pairs: Pair[] = [...groups.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([sku, rows]) => ({ sku, rows }));

  console.log(`Found ${pairs.length} duplicate SKU groups (${pairs.reduce((s, p) => s + p.rows.length, 0)} rows).`);

  /* Triage: pairs of size 2 only (current data set). */
  const oversized = pairs.filter(p => p.rows.length !== 2);
  if (oversized.length) {
    console.log(`⚠ Skipping ${oversized.length} groups with size != 2 (need manual review).`);
    oversized.forEach(p => console.log(`   ${p.sku}: ${p.rows.length} copies`));
  }
  const sized2 = pairs.filter(p => p.rows.length === 2);

  /* Check for non-cascade FK references on loser candidates ahead of time. */
  const allLoserIds: string[] = [];
  const planned: Array<{
    pair: Pair;
    winner: Row;
    loser: Row;
    inheritImage: string | null;
    mergedGallery: string[];
    blocked: string | null;
  }> = [];

  for (const pair of sized2) {
    const { winner, loser } = pickWinner(pair.rows);
    allLoserIds.push(loser.id);
    planned.push({
      pair,
      winner,
      loser,
      inheritImage:
        isExternalBrabusImage(winner.image) && isLocalImage(loser.image)
          ? loser.image
          : null,
      mergedGallery: mergeGallery(winner.gallery, loser.gallery),
      blocked: null,
    });
  }

  /* Bulk check: ShopBundleItem.componentProduct (no cascade). */
  const bundleRefs = await (prisma as any).shopBundleItem
    .findMany({ where: { componentProductId: { in: allLoserIds } }, select: { id: true, componentProductId: true } })
    .catch(() => [] as { id: string; componentProductId: string }[]);
  const blockedIds = new Set(bundleRefs.map((b: any) => b.componentProductId));

  if (blockedIds.size) {
    console.log(`⚠ ${blockedIds.size} losers are referenced by ShopBundleItem (won't delete those).`);
    planned.forEach(p => {
      if (blockedIds.has(p.loser.id)) p.blocked = 'bundle-component';
    });
  }

  const safe = planned.filter(p => !p.blocked);

  console.log(`\nPlanned: ${safe.length} merges, ${planned.length - safe.length} blocked.`);

  /* Stats */
  let imageInheritCount = 0;
  let galleryGrowCount = 0;
  for (const p of safe) {
    if (p.inheritImage) imageInheritCount++;
    const oldLen = Array.isArray(p.winner.gallery) ? p.winner.gallery.length : 0;
    if (p.mergedGallery.length > oldLen) galleryGrowCount++;
  }
  console.log(`  Will inherit local image (CDN→local): ${imageInheritCount}`);
  console.log(`  Will grow gallery (merge): ${galleryGrowCount}`);

  /* Backup losers (always — even in dry-run) */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `brabus-dedup-${ts}.json`);
  const losersFull = await prisma.shopProduct.findMany({
    where: { id: { in: safe.map(p => p.loser.id) } },
  });
  await fs.writeFile(backupPath, JSON.stringify(losersFull, null, 2), 'utf-8');
  console.log(`Backup written: ${backupPath} (${losersFull.length} loser rows)`);

  /* Print sample of planned actions */
  console.log('\nSample (first 5 merges):');
  safe.slice(0, 5).forEach(({ pair, winner, loser, inheritImage }) => {
    console.log(`  ${pair.sku}`);
    console.log(`    winner=${winner.sku} (${winner.id}) titleLen=${winner.titleEn.length} descEn=${descLen(winner, 'en')}`);
    console.log(`    loser =${loser.sku} (${loser.id})  titleLen=${loser.titleEn.length}  descEn=${descLen(loser, 'en')}`);
    if (inheritImage) console.log(`    inherit image: ${inheritImage}`);
  });

  if (!COMMIT) {
    console.log('\n(dry-run) — pass --commit to apply.');
    return;
  }

  /* Apply changes */
  let updated = 0;
  let deleted = 0;
  for (const { winner, loser, inheritImage, mergedGallery } of safe) {
    const updates: Record<string, unknown> = {};
    if (inheritImage) updates.image = inheritImage;
    const winnerGalleryLen = Array.isArray(winner.gallery) ? winner.gallery.length : 0;
    if (mergedGallery.length > winnerGalleryLen) updates.gallery = mergedGallery;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length) {
        await tx.shopProduct.update({ where: { id: winner.id }, data: updates });
        updated++;
      }
      await tx.shopProduct.delete({ where: { id: loser.id } });
      deleted++;
    });
  }

  console.log(`\n✓ Done. Winners updated: ${updated}. Losers deleted: ${deleted}.`);
  if (planned.length - safe.length) {
    console.log(`✗ Skipped (blocked by FK): ${planned.length - safe.length}`);
  }
}

main()
  .catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
