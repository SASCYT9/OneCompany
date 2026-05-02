/**
 * Apply EU-native do88performance.eu prices to DO88 products in our DB.
 *
 * Hard rules:
 *   - ONLY updates SKUs that already exist in our DB (per shop-owner brief
 *     "тільки ті SKU які в нас включені"). New SKUs from the scrape are
 *     ignored — those would need separate review for chassis-exclusion fits.
 *   - ONLY writes `priceEur` on ShopProduct + matching ShopVariant. Never
 *     touches titles, body HTML, tags, media, or anything else (per
 *     `minimal_reimport.md` memory: shop DB has polished translations not in
 *     JSON; full reimport wipes them).
 *   - Defaults to dry-run. Requires --apply to actually write.
 *   - Snapshots every (id, oldPrice, newPrice, sku) to artifacts/do88-price-
 *     apply/<ts>/before-after.json BEFORE any write so the change is
 *     trivially reversible.
 *   - Optional --skip-large-drop: skip rows where the new price is more than
 *     35% below the old one. These tend to be listing-card sale prices on
 *     items without detail pages (BMC air filters, ACCDA airbox), which the
 *     user has not yet decided to surface as discounts.
 *
 * Usage:
 *   npx tsx scripts/do88/apply-eu-prices.ts                 # dry run
 *   npx tsx scripts/do88/apply-eu-prices.ts --apply         # actually write
 *   npx tsx scripts/do88/apply-eu-prices.ts --apply --skip-large-drop
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const SCRAPED = path.join(process.cwd(), 'scripts/do88/scraped/do88-eu-prices.json');
const APPLY = process.argv.includes('--apply');
const SKIP_LARGE_DROP = process.argv.includes('--skip-large-drop');
const LARGE_DROP_PCT = 35; // % below old price ⇒ "large drop"
const ONLY_NONZERO_DELTA = 0.01; // skip rows where the new price equals the old to the cent

type EuItem = { sku: string; titleEn: string; priceEur: number; sourceUrl: string; source?: string };

function buildEuLookup(eu: EuItem[]) {
  const map = new Map<string, EuItem>();
  for (const p of eu) {
    map.set(p.sku, p);
    map.set(p.sku.toLowerCase(), p);
    map.set(p.sku.toUpperCase(), p);
  }
  return (sku: string | null | undefined) => {
    if (!sku) return null;
    const candidates = [
      sku,
      sku.toLowerCase(),
      sku.toUpperCase(),
      sku.replace(/^do88-/i, ''),
      sku.replace(/^do88-/i, '').toLowerCase(),
      sku.replace(/^do88-/i, '').toUpperCase(),
    ];
    for (const c of candidates) {
      const f = map.get(c);
      if (f) return f;
    }
    return null;
  };
}

async function main() {
  if (!fs.existsSync(SCRAPED)) {
    console.error(`❌ Scraped file missing: ${SCRAPED}`);
    process.exit(1);
  }
  const eu: EuItem[] = JSON.parse(fs.readFileSync(SCRAPED, 'utf-8'));
  const findEu = buildEuLookup(eu);
  console.log(`📥 EU items: ${eu.length}  (mode=${APPLY ? 'APPLY' : 'DRY RUN'}${SKIP_LARGE_DROP ? ', skip-large-drop' : ''})`);

  const prisma = new PrismaClient();
  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'DO88', mode: 'insensitive' } },
    select: {
      id: true,
      slug: true,
      sku: true,
      titleEn: true,
      priceEur: true,
      variants: { select: { id: true, sku: true, priceEur: true } },
    },
  });
  console.log(`📥 DB DO88 products: ${dbProducts.length}`);

  const plan: Array<{
    id: string;
    slug: string;
    sku: string;
    titleEn: string;
    oldEur: number;
    newEur: number;
    deltaEur: number;
    deltaPct: number;
    variantUpdates: Array<{ id: string; sku: string; oldEur: number; newEur: number }>;
    source?: string;
    skipReason?: string;
  }> = [];

  let unmatched = 0;
  let identical = 0;
  let largeDrops = 0;

  for (const p of dbProducts) {
    const eu = findEu(p.sku);
    if (!eu) { unmatched++; continue; }

    const oldEur = p.priceEur ?? 0;
    const newEur = eu.priceEur;
    const deltaEur = +(newEur - oldEur).toFixed(2);
    if (Math.abs(deltaEur) < ONLY_NONZERO_DELTA) { identical++; continue; }

    const deltaPct = oldEur > 0 ? +((deltaEur / oldEur) * 100).toFixed(2) : 100;
    let skipReason: string | undefined;
    if (SKIP_LARGE_DROP && deltaPct < -LARGE_DROP_PCT) {
      skipReason = `large drop (${deltaPct}% < -${LARGE_DROP_PCT}%)`;
      largeDrops++;
    }

    const variantUpdates = p.variants
      .map((v) => {
        const vEu = findEu(v.sku);
        const vNew = vEu ? vEu.priceEur : newEur; // fall back to product price
        const vOld = v.priceEur ?? 0;
        return Math.abs(vNew - vOld) < ONLY_NONZERO_DELTA
          ? null
          : { id: v.id, sku: v.sku ?? '', oldEur: vOld, newEur: vNew };
      })
      .filter((x): x is { id: string; sku: string; oldEur: number; newEur: number } => !!x);

    plan.push({
      id: p.id,
      slug: p.slug,
      sku: p.sku ?? '',
      titleEn: p.titleEn ?? '',
      oldEur,
      newEur,
      deltaEur,
      deltaPct,
      variantUpdates,
      source: eu.source,
      skipReason,
    });
  }

  const willApply = plan.filter((r) => !r.skipReason);
  console.log(`\n📊 Plan:`);
  console.log(`   matched in EU:                    ${plan.length + identical}`);
  console.log(`     - identical, no change needed:  ${identical}`);
  console.log(`     - to update:                    ${plan.length}`);
  console.log(`     - skipped (large drop):         ${SKIP_LARGE_DROP ? largeDrops : '— (use --skip-large-drop)'}`);
  console.log(`     - applying:                     ${willApply.length}`);
  console.log(`   unmatched DB SKUs (untouched):    ${unmatched}`);

  // Snapshot before any write — even on dry run, so the user can review what
  // would change.
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'artifacts/do88-price-apply', ts);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'plan.json'),
    JSON.stringify({ apply: APPLY, skipLargeDrop: SKIP_LARGE_DROP, plan }, null, 2),
    'utf-8'
  );
  console.log(`\n💾 Plan snapshot: ${outDir}/plan.json`);

  if (!APPLY) {
    console.log('\n👉 Dry run only. Re-run with --apply to write.');
    await prisma.$disconnect();
    return;
  }

  // Apply
  console.log(`\n✏️  Applying ${willApply.length} updates...`);
  let okCount = 0;
  let errCount = 0;
  for (const row of willApply) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.shopProduct.update({ where: { id: row.id }, data: { priceEur: row.newEur } });
        for (const v of row.variantUpdates) {
          await tx.shopProductVariant.update({ where: { id: v.id }, data: { priceEur: v.newEur } });
        }
      });
      okCount++;
    } catch (err) {
      errCount++;
      console.error(`   ❌ ${row.sku}: ${(err as Error).message}`);
    }
  }
  console.log(`\n✅ Applied: ${okCount}`);
  console.log(`❌ Errors:  ${errCount}`);

  // Per project memory `dev_shop_products_cache.md` — after Prisma writes to
  // ShopProduct in dev, the .shop-products-dev-cache.json (3h TTL) keeps
  // stale data unless we delete it.
  const cachePath = path.join(process.cwd(), '.shop-products-dev-cache.json');
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    console.log(`🧹 Deleted dev cache: ${cachePath}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
