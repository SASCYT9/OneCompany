/**
 * Targeted price fix for ipe-porsche-992-gt3-full-exhaust-system. The catalog
 * importer collapsed all 12 variants onto the single $17,400 "Pro Version
 * Full System (Cat Pipe)" row because the variant option labels don't say
 * "Pro Version" — there's no token to anchor on.
 *
 * 2026 V2.0 prices we use:
 *   Equal-Length Headers — Cat Pipe         1P92G3-01-A0M0-1S  $10,300
 *   Equal-Length Headers — Catless Straight 1P92G3-01-B0M0-1S  $ 9,500
 *   Cat Back (Stainless)                    1P92G3-03-EVP0-6N  $ 5,900
 *   Cat Back (Titanium)                     1P92G3-23-EVP0-6N  $ 7,300
 *   Pro Version Full System (Cat Pipe)      1P92G3-AVFM0-1     $17,400
 *   Pro Version Full System (Catless)       1P92G3-BVFM0-1     $16,600
 *
 * Variant axes in DB: [Material, Headers/Mid Pipe, Cell].
 * Variants like "200 Cell / OPF" without explicit headers we treat as
 * Equal-Length Headers (the iPE default for the Full System).
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
    where: { slug: 'ipe-porsche-992-gt3-full-exhaust-system' },
    include: { variants: true },
  });
  if (!product) {
    console.log('product not found');
    await prisma.$disconnect();
    return;
  }

  const headersCat = 10300; // 1P92G3-01-A0M0-1S
  const headersCatless = 9500; // 1P92G3-01-B0M0-1S
  const catbackSs = 5900; // 1P92G3-03-EVP0-6N
  const catbackTi = 7300; // 1P92G3-23-EVP0-6N

  function priceFor(opts: { material: string; cell: string }) {
    const isTi = /titanium/i.test(opts.material);
    const cb = isTi ? catbackTi : catbackSs;
    const isCatless = /catless/i.test(opts.cell);
    const headers = isCatless ? headersCatless : headersCat;
    return cb + headers;
  }

  for (const v of product.variants) {
    const opts = {
      material: v.option1Value ?? '',
      cell: [v.option2Value, v.option3Value].filter(Boolean).join(' '),
    };
    const target = priceFor(opts);
    const current = v.priceUsd != null ? Number(v.priceUsd) : null;
    const tag = current === target ? 'unchanged' : 'CHANGE';
    console.log(`  [${tag}] ${v.option1Value} / ${v.option2Value ?? ''} / ${v.option3Value ?? ''}  $${current ?? '?'} -> $${target}`);
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
