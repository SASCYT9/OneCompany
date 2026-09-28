/**
 * Apply the do88 manufacturer's EUR price rule to already-listed products.
 *
 * Hard rules:
 *   - Uses the supplier's Consumer / Incl. VAT source price and adds 10%,
 *     rounded to cents. Never compounds from the current OneCompany price.
 *   - ONLY updates SKUs already in our DB. New SKUs need a separate catalog
 *     review, including manufacturer and fitment confirmation.
 *   - Excludes known third-party product lines sold by the supplier.
 *   - ONLY writes `priceEur` on ShopProduct + matching ShopVariant. Never
 *     touches titles, body HTML, tags, media, or anything else (per
 *     `minimal_reimport.md` memory: shop DB has polished translations not in
 *     JSON; full reimport wipes them).
 *   - Defaults to dry-run. Requires --apply and a reviewed SKU allowlist to write.
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
 *   npx tsx scripts/do88/apply-eu-prices.ts --prices=tmp/do88-current-price-refresh.json
 *   npx tsx scripts/do88/apply-eu-prices.ts --apply --prices=feed.json --approved-skus=approved.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { calculateDo88CustomerPriceEur } from '../../src/lib/do88Pricing';

const APPLY = process.argv.includes('--apply');
const SKIP_LARGE_DROP = process.argv.includes('--skip-large-drop');
const flagValue = (name: string) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const SCRAPED = path.resolve(flagValue('--prices') || 'scripts/do88/scraped/do88-eu-prices.json');
const APPROVED_SKUS_PATH = flagValue('--approved-skus') ? path.resolve(flagValue('--approved-skus')!) : null;
const LARGE_DROP_PCT = 35; // % below old price ⇒ "large drop"
const ONLY_NONZERO_DELTA = 0.01; // skip rows where the new price equals the old to the cent
const EXTERNAL_PRODUCT_MARKERS = /\b(?:BMC|GFB|Garrett|Setrab|Mikalor)\b/i;

type EuItem = {
  sku: string;
  titleEn: string;
  priceEur: number;
  sourceUrl: string;
  source?: string;
  sourceRetrievedAt?: string;
};

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
  const parsedFeed: unknown = JSON.parse(fs.readFileSync(SCRAPED, 'utf-8'));
  let sourceFeedErrors: unknown[] = [];
  let eu: EuItem[];
  if (Array.isArray(parsedFeed)) {
    eu = parsedFeed as EuItem[];
  } else if (parsedFeed && typeof parsedFeed === 'object') {
    const feed = parsedFeed as { products?: unknown; errors?: unknown; sourceMode?: unknown };
    if (!Array.isArray(feed.products)) throw new Error('Price feed object must contain a products array');
    eu = feed.products.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        sku: String(item.sku ?? item.pageSku ?? item.requestedSku ?? ''),
        titleEn: String(item.titleEn ?? ''),
        priceEur: Number(item.priceEur),
        sourceUrl: String(item.sourceUrl ?? ''),
        source: typeof item.source === 'string' ? item.source : 'detail',
        sourceRetrievedAt: typeof item.sourceRetrievedAt === 'string' ? item.sourceRetrievedAt : undefined,
      };
    });
    sourceFeedErrors = Array.isArray(feed.errors) ? feed.errors : [];
  } else {
    throw new Error('Price feed must be an array or contain a products array');
  }
  if (APPLY && sourceFeedErrors.length) {
    throw new Error(`Refusing to apply an incomplete supplier feed with ${sourceFeedErrors.length} fetch errors`);
  }
  let approvedSkuSet: Set<string> | null = null;
  if (APPLY) {
    if (!APPROVED_SKUS_PATH) throw new Error('Applying prices requires --approved-skus=<reviewed JSON array>');
    if (!fs.existsSync(APPROVED_SKUS_PATH)) throw new Error(`Approved SKU allowlist missing: ${APPROVED_SKUS_PATH}`);
    const approved: unknown = JSON.parse(fs.readFileSync(APPROVED_SKUS_PATH, 'utf-8'));
    if (!Array.isArray(approved) || approved.some((sku) => typeof sku !== 'string' || !sku.trim())) {
      throw new Error('Approved SKU allowlist must be a non-empty-string JSON array');
    }
    approvedSkuSet = new Set(approved.map((sku: string) => sku.trim().toLowerCase()));
    if (!approvedSkuSet.size) throw new Error('Approved SKU allowlist cannot be empty');
  }
  const findEu = buildEuLookup(eu);
  console.log(`📥 EU items: ${eu.length}  (mode=${APPLY ? 'APPLY' : 'DRY RUN'}${sourceFeedErrors.length ? `, source-errors=${sourceFeedErrors.length}` : ''}${SKIP_LARGE_DROP ? ', skip-large-drop' : ''})`);

  const prisma = new PrismaClient();
  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'DO88', mode: 'insensitive' } },
    select: {
      id: true,
      slug: true,
      sku: true,
      titleEn: true,
      categoryEn: true,
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
  let outsideDo88Scope = 0;
  let outsideApprovedSkuList = 0;

  for (const p of dbProducts) {
    const eu = findEu(p.sku);
    if (!eu) { unmatched++; continue; }

    if (EXTERNAL_PRODUCT_MARKERS.test(`${eu.titleEn} ${p.titleEn} ${p.categoryEn}`)) {
      outsideDo88Scope++;
      continue;
    }
    if (APPLY && !approvedSkuSet?.has((p.sku ?? '').trim().toLowerCase())) {
      outsideApprovedSkuList++;
      continue;
    }

    const oldEur = p.priceEur ?? 0;
    const newEur = calculateDo88CustomerPriceEur(eu.priceEur);
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
        if (!vEu || EXTERNAL_PRODUCT_MARKERS.test(`${vEu.titleEn} ${eu.titleEn}`)) return null;
        if (APPLY && !approvedSkuSet?.has((v.sku ?? '').trim().toLowerCase())) return null;
        const vNew = calculateDo88CustomerPriceEur(vEu.priceEur);
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
      sourceUrl: eu.sourceUrl,
      sourceRetrievedAt: eu.sourceRetrievedAt ?? null,
      sourceCustomerPriceEur: eu.priceEur,
      markupPct: 10,
      skipReason,
    });
  }

  const willApply = plan.filter((r) => !r.skipReason);
  console.log(`\n📊 Plan:`);
  console.log(`   matched in EU:                    ${plan.length + identical}`);
  console.log(`   skipped outside do88 maker scope: ${outsideDo88Scope}`);
  if (APPLY) console.log(`   skipped outside reviewed SKU allowlist: ${outsideApprovedSkuList}`);
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
    JSON.stringify({
      apply: APPLY,
      generatedAt: new Date().toISOString(),
      sourceMode: "EUR / Consumer Incl. VAT",
      markupPct: 10,
      sourceFeedErrorCount: sourceFeedErrors.length,
      skipLargeDrop: SKIP_LARGE_DROP,
      approvedSkuCount: approvedSkuSet?.size ?? null,
      plan,
    }, null, 2),
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
