/**
 * Reads data/racechip-outliers-fix.json (produced by fix-racechip-outliers.mjs)
 * and writes the corrected priceEur to ShopProduct + ShopProductVariant.
 *
 * Sanity rules accepted:
 *  - finalPriceEur in [100, 1500) → standard 3-tier vehicle, write it.
 *  - finalPriceEur >= 1500 AND tier was "-not-available" AND the page had
 *    only one high-priced number → premium-only chip, the high price is
 *    real (matches racechip.eu); write it (a no-op when DB already has it).
 *  - Anything else → skip and warn.
 *
 * Pass --dry to print intentions without writing.
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry');
const FILE = path.join(process.cwd(), 'data', 'racechip-outliers-fix.json');
if (!fs.existsSync(FILE)) {
  console.error('Missing', FILE, '— run fix-racechip-outliers.mjs first.');
  process.exit(1);
}
const items = JSON.parse(fs.readFileSync(FILE, 'utf-8'));

// Re-derive the final price from the dump rather than trusting fix-racechip-outliers.mjs
// finalPriceEur, because that script's "drop outlier" branch can mis-pick an
// add-on price (e.g. 179€) for premium vehicles where the GTS 5 tier is
// flagged "-not-available" and the only real product price on the page is the
// premium one.
function derivePrice(r) {
  const cls = r.tierContainerClass || '';
  const tierAvailable = cls.includes('-is-available') && !cls.includes('-not-available');
  const ac = r.appControlPrice || 59;
  if (tierAvailable && r.tierPrices?.length) {
    const base = Math.max(...r.tierPrices);
    if (base > 100 && base < 1500) {
      return { finalEur: base + ac, base, reason: 'standard tier (-is-available, tierPrices)' };
    }
  }
  // Premium-only: tier is not available, the page exposes a single high price
  // (>=1500). Trust that number even if there is also a low add-on price next
  // to it.
  if (!tierAvailable && r.bodyPrices?.length) {
    const high = r.bodyPrices.filter(p => p >= 1000);
    if (high.length === 1) {
      return { finalEur: high[0] + ac, base: high[0], reason: 'premium-only (single high price)' };
    }
  }
  return { finalEur: 0, reason: 'unusual shape' };
}

function classifyAccept(r) {
  const d = derivePrice(r);
  if (!d.finalEur) return { accept: false, reason: d.reason, finalEur: 0 };
  return { accept: true, reason: d.reason, finalEur: d.finalEur };
}

const prisma = new PrismaClient();
try {
  for (const r of items) {
    const { accept, reason, finalEur } = classifyAccept(r);
    if (!accept) { console.log(`  ⏭  skip ${r.slug} (${reason})`); continue; }
    const newEur = finalEur.toString();
    const before = await prisma.shopProduct.findUnique({
      where: { slug: r.slug },
      select: { id: true, priceEur: true },
    });
    if (!before) { console.log(`  ⚠️  not found: ${r.slug}`); continue; }
    if (DRY) {
      console.log(`  🔎 dry: ${r.slug}: ${before.priceEur} → ${newEur} EUR  (${reason})`);
      continue;
    }
    await prisma.shopProduct.update({
      where: { slug: r.slug },
      data: { priceEur: newEur },
    });
    const v = await prisma.shopProductVariant.updateMany({
      where: { productId: before.id },
      data: { priceEur: newEur },
    });
    const same = String(before.priceEur) === newEur;
    console.log(`  ${same ? '➖ unchanged' : '✏️  updated '} ${r.slug}: ${before.priceEur} → ${newEur} EUR  [${v.count} variants]  (${reason})`);
  }
} finally {
  await prisma.$disconnect();
}
