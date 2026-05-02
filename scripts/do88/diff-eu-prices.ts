/**
 * Compare scraped do88performance.eu (EUR-native) prices against the current
 * DO88 prices in our DB. Pure dry-run — emits a report only, never writes.
 *
 * Output:
 *   - artifacts/do88-price-diff/<timestamp>/diff.json
 *   - artifacts/do88-price-diff/<timestamp>/diff.csv
 *
 * Usage: npx tsx scripts/do88/diff-eu-prices.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const SCRAPED = path.join(process.cwd(), 'scripts/do88/scraped/do88-eu-prices.json');

type EuItem = { sku: string; titleEn: string; priceEur: number; sourceUrl: string };

async function main() {
  if (!fs.existsSync(SCRAPED)) {
    console.error(`❌ Scraped file missing: ${SCRAPED}\n   Run: node scripts/do88/scrape-eu-prices.mjs first.`);
    process.exit(1);
  }
  const eu: EuItem[] = JSON.parse(fs.readFileSync(SCRAPED, 'utf-8'));
  const euBySku = new Map(eu.map((p) => [p.sku, p]));
  console.log(`📥 Scraped EU items: ${eu.length}`);

  const prisma = new PrismaClient();
  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'DO88', mode: 'insensitive' } },
    select: { id: true, slug: true, sku: true, titleEn: true, priceEur: true, isPublished: true },
  });
  console.log(`📥 DB DO88 products: ${dbProducts.length}`);
  await prisma.$disconnect();

  // Index DB by SKU (case-insensitive). DB SKUs in our import sometimes have
  // variations like "do88-kit13-r" vs raw "kit13-r" — try both.
  const dbBySku = new Map<string, (typeof dbProducts)[number]>();
  for (const p of dbProducts) {
    if (!p.sku) continue;
    dbBySku.set(p.sku, p);
    dbBySku.set(p.sku.toLowerCase(), p);
    // Strip "do88-" prefix (added by makeSlug variants in earlier imports).
    const stripped = p.sku.replace(/^do88-/i, '');
    if (stripped !== p.sku) {
      dbBySku.set(stripped, p);
      dbBySku.set(stripped.toLowerCase(), p);
    }
  }

  const rows: Array<{
    sku: string;
    title: string;
    oldEur: number | null;
    newEur: number;
    deltaEur: number | null;
    deltaPct: number | null;
    status: 'NEW' | 'CHANGED' | 'SAME' | 'MINOR';
    dbSlug: string | null;
  }> = [];

  for (const item of eu) {
    const db =
      dbBySku.get(item.sku) ??
      dbBySku.get(item.sku.toLowerCase()) ??
      dbBySku.get(`do88-${item.sku}`) ??
      dbBySku.get(`do88-${item.sku.toLowerCase()}`);

    if (!db) {
      rows.push({
        sku: item.sku,
        title: item.titleEn,
        oldEur: null,
        newEur: item.priceEur,
        deltaEur: null,
        deltaPct: null,
        status: 'NEW',
        dbSlug: null,
      });
      continue;
    }

    const oldEur = db.priceEur ?? 0;
    const deltaEur = +(item.priceEur - oldEur).toFixed(2);
    const deltaPct = oldEur > 0 ? +((deltaEur / oldEur) * 100).toFixed(1) : null;
    let status: 'NEW' | 'CHANGED' | 'SAME' | 'MINOR' = 'SAME';
    if (deltaPct === null) status = 'NEW';
    else if (Math.abs(deltaPct) >= 5) status = 'CHANGED';
    else if (Math.abs(deltaPct) >= 1) status = 'MINOR';

    rows.push({
      sku: item.sku,
      title: item.titleEn || db.titleEn || '',
      oldEur,
      newEur: item.priceEur,
      deltaEur,
      deltaPct,
      status,
      dbSlug: db.slug,
    });
  }

  // DB-only (in our shop but not seen on do88.eu)
  const seenSkus = new Set(rows.map((r) => r.sku.toLowerCase()));
  const orphans = dbProducts.filter((p) => {
    if (!p.sku) return false;
    const variants = [p.sku, p.sku.toLowerCase(), p.sku.replace(/^do88-/i, ''), p.sku.replace(/^do88-/i, '').toLowerCase()];
    return !variants.some((v) => euBySku.has(v) || euBySku.has(v.toUpperCase()));
  });

  // Counts
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { NEW: 0, CHANGED: 0, SAME: 0, MINOR: 0 } as Record<string, number>
  );

  console.log(`\n📊 Diff summary:`);
  console.log(`   NEW (in EU, not in DB):   ${counts.NEW}`);
  console.log(`   CHANGED (≥5% diff):        ${counts.CHANGED}`);
  console.log(`   MINOR (1–5% diff):         ${counts.MINOR}`);
  console.log(`   SAME (<1% diff):           ${counts.SAME}`);
  console.log(`   ORPHANS (DB but not EU):  ${orphans.length}`);

  console.log(`\n🔥 Top 20 CHANGED by abs delta:`);
  rows
    .filter((r) => r.status === 'CHANGED')
    .sort((a, b) => Math.abs(b.deltaEur ?? 0) - Math.abs(a.deltaEur ?? 0))
    .slice(0, 20)
    .forEach((r) => {
      const sign = (r.deltaEur ?? 0) > 0 ? '+' : '';
      console.log(`   ${r.sku.padEnd(28)} €${(r.oldEur ?? 0).toFixed(2).padStart(8)} → €${r.newEur.toFixed(2).padStart(8)}  (${sign}${r.deltaPct}%)  ${r.title.slice(0, 50)}`);
    });

  // Persist artifacts
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'artifacts/do88-price-diff', ts);
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, 'diff.json'),
    JSON.stringify({ counts, orphansCount: orphans.length, rows, orphans }, null, 2),
    'utf-8'
  );

  const csvHeader = 'sku,status,old_eur,new_eur,delta_eur,delta_pct,db_slug,title\n';
  const csvBody = rows
    .sort((a, b) => Math.abs(b.deltaEur ?? 0) - Math.abs(a.deltaEur ?? 0))
    .map((r) =>
      [
        r.sku,
        r.status,
        r.oldEur ?? '',
        r.newEur,
        r.deltaEur ?? '',
        r.deltaPct ?? '',
        r.dbSlug ?? '',
        '"' + (r.title || '').replace(/"/g, '""') + '"',
      ].join(',')
    )
    .join('\n');
  fs.writeFileSync(path.join(outDir, 'diff.csv'), csvHeader + csvBody, 'utf-8');

  console.log(`\n💾 Wrote: ${outDir}/diff.json`);
  console.log(`💾 Wrote: ${outDir}/diff.csv`);
  console.log(`\n👉 Review the diff. To apply, run scripts/do88/apply-eu-prices.ts (not yet created — built only after you confirm).`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
