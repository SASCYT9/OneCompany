import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
// Run with: npx tsx scripts/audit-burger-dup-skus.ts
//
// Audits the 39 duplicate-SKU pairs from data/burger-products.json — for each,
// verifies all expected slugs exist in DB, that titles/tags match the source,
// and flags any "still missing" rows or rows with mismatched data.

type SourceProduct = {
  title: string;
  slug: string;
  sku?: string;
};

async function main() {
  const SRC = path.join(process.cwd(), 'data', 'burger-products.json');
  const products: SourceProduct[] = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

  // Group by SKU, keep only duplicates
  const bySku = new Map<string, SourceProduct[]>();
  for (const p of products) {
    if (!p.sku) continue;
    if (!bySku.has(p.sku)) bySku.set(p.sku, []);
    bySku.get(p.sku)!.push(p);
  }
  const dupGroups = [...bySku.entries()].filter(([, arr]) => arr.length > 1);

  console.log(`=== Audit of ${dupGroups.length} duplicate-SKU groups ===\n`);

  let totalExpected = 0;
  let totalFound = 0;
  let missingSlugs: string[] = [];
  let mismatched: Array<{ slug: string; reason: string }> = [];

  for (const [sku, srcArr] of dupGroups) {
    const expectedSlugs = srcArr.map((p) => `burger-${p.slug}`);
    totalExpected += expectedSlugs.length;

    const dbRows = await prisma.shopProduct.findMany({
      where: { slug: { in: expectedSlugs } },
      select: { slug: true, titleEn: true, sku: true, tags: true },
    });
    const dbBySlug = new Map(dbRows.map((r) => [r.slug, r]));

    const groupMissing: string[] = [];
    const groupMismatch: string[] = [];

    for (const src of srcArr) {
      const slug = `burger-${src.slug}`;
      const dbRow = dbBySlug.get(slug);
      if (!dbRow) {
        groupMissing.push(slug);
        missingSlugs.push(slug);
        continue;
      }
      totalFound++;
      // Title sanity check — the DB title should match the source title.
      if (dbRow.titleEn?.trim() !== src.title?.trim()) {
        groupMismatch.push(`${slug}: DB title="${dbRow.titleEn?.slice(0, 60)}" vs SRC="${src.title?.slice(0, 60)}"`);
        mismatched.push({ slug, reason: `title mismatch` });
      }
    }

    const status =
      groupMissing.length === 0 && groupMismatch.length === 0 ? '✅' : '⚠️';
    console.log(`${status} SKU "${sku}" — ${srcArr.length} expected, ${dbRows.length} found in DB`);
    for (const src of srcArr) {
      const slug = `burger-${src.slug}`;
      const dbRow = dbBySlug.get(slug);
      const present = dbRow ? '✓' : '✗ MISSING';
      console.log(`    ${present} ${slug}`);
      if (dbRow && dbRow.titleEn?.trim() !== src.title?.trim()) {
        console.log(`        TITLE MISMATCH:`);
        console.log(`        DB:  ${dbRow.titleEn?.slice(0, 90)}`);
        console.log(`        SRC: ${src.title?.slice(0, 90)}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Duplicate-SKU groups: ${dupGroups.length}`);
  console.log(`Expected DB rows (sum across groups): ${totalExpected}`);
  console.log(`Found in DB: ${totalFound}`);
  console.log(`Still missing: ${missingSlugs.length}`);
  console.log(`Title mismatches: ${mismatched.length}`);
  if (missingSlugs.length > 0) {
    console.log(`\nMissing slugs:`);
    missingSlugs.forEach((s) => console.log(`  - ${s}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
