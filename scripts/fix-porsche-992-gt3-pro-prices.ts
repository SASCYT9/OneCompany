/**
 * Targeted fix for ipe-porsche-911-gt3-gt3-rs-992-full-exhaust-system — this
 * is iPE's Pro Version full system, separate from the regular 992 GT3 full
 * system. All 3 variants currently flat-priced at $16,600 (catless price);
 * the catted variant should be higher and the bare catback lower.
 *
 * 2026 V2.0 prices:
 *   Pro Version Full System (Cat Pipe)            1P92G3-AVFM0-1  $17,400
 *   Pro Version Full System (Catless Straight)    1P92G3-BVFM0-1  $16,600
 *   Cat Back (Stainless)                          0P92G3-NVPM0-2  $ 6,900
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
    where: { slug: 'ipe-porsche-911-gt3-gt3-rs-992-full-exhaust-system' },
    include: { variants: true },
  });
  if (!product) {
    console.log('product not found');
    await prisma.$disconnect();
    return;
  }

  for (const v of product.variants) {
    const opt = `${v.option2Value ?? ''}`.toLowerCase();
    let target: number;
    if (/catless/.test(opt)) {
      target = 16600;
    } else if (/200\s*cell|cat\s*pipe|catted/.test(opt)) {
      target = 17400;
    } else if (/catback/.test(opt)) {
      target = 6900;
    } else {
      console.log(`  skip unrecognized: ${v.option2Value}`);
      continue;
    }
    const current = v.priceUsd != null ? Number(v.priceUsd) : null;
    const tag = current === target ? 'unchanged' : 'CHANGE';
    console.log(`  [${tag}] ${v.option1Value} / ${v.option2Value}  $${current ?? '?'} -> $${target}`);
    if (APPLY && current !== target) {
      await prisma.shopProductVariant.update({
        where: { id: v.id },
        data: { priceUsd: new Decimal(target.toFixed(2)) },
      });
    }
  }
  console.log(APPLY ? '\n(applied)' : '\n(dry-run — pass --apply)');
  await prisma.$disconnect();
})();
