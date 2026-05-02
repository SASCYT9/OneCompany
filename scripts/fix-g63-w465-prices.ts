/**
 * Targeted price fix for the G63 W465 product I just added.
 *
 * iPE's Shopify lists three downpipe options (Catted / Catless / Non-Downpipe)
 * but the 2026 V2.0 price list only carries the Cat Back ($7,700) for W465.
 * The downpipe SKU for the predecessor W464-G63 is `0Z6363-A0NN0-3` /
 * `0Z6363-A0NM0-3` at $4,400 and is mechanically compatible with W465 (same
 * 4.0L V8 platform). Catless isn't catalogued for any G63 generation.
 *
 * Mapping:
 *   Catted Downpipe + Cat-back → $12,100  ($7,700 cat-back + $4,400 catted DP)
 *   Catless Downpipe + Cat-back → $7,700  (no SKU; quote-only, fall back to cat-back)
 *   Non-Downpipe + Cat-back → $7,700      (just the cat-back)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

(async () => {
  const product = await prisma.shopProduct.findFirst({
    where: { slug: 'ipe-mercedes-benz-amg-g63-w465-exhaust-system' },
    include: { variants: true },
  });
  if (!product) {
    console.log('product not found');
    await prisma.$disconnect();
    return;
  }

  const desired: Record<string, number> = {
    'Catted Downpipe': 12100,
    'Catless Downpipe': 7700,
    'Non-Downpipe': 7700,
  };

  for (const v of product.variants) {
    const key = v.option1Value ?? '';
    const target = desired[key];
    if (target == null) {
      console.log(`  skip ${key} (no mapping)`);
      continue;
    }
    const current = v.priceUsd != null ? Number(v.priceUsd) : null;
    if (current === target) {
      console.log(`  unchanged: ${key} @ $${current}`);
      continue;
    }
    console.log(`  ${key}: $${current ?? '?'} -> $${target}`);
    if (APPLY) {
      await prisma.shopProductVariant.update({
        where: { id: v.id },
        data: { priceUsd: new Decimal(target.toFixed(2)) },
      });
    }
  }
  console.log(APPLY ? '\n(applied)' : '\n(dry-run — pass --apply)');
  await prisma.$disconnect();
})();
