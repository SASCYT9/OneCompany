/**
 * Targeted price corrections for the remaining iPE flat-priced products my v1
 * update either over-corrected or couldn't resolve. Each entry is hand-mapped
 * to the 2026 V2.0 list so we never have to re-derive these from token-scoring.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

type Mapping = {
  slug: string;
  match: (v: { option1Value: string | null; option2Value: string | null; option3Value: string | null }) => number | null;
};

const MAPPINGS: Mapping[] = [
  {
    // Lamborghini Huracán Tecnica — both OPF and Non-OPF cat-back are $7,600
    // in the 2026 list (`0LHUE-NVN00-2` / `0LHUE-NVNO0-2`). My earlier run
    // bumped them to $8,000 which doesn't match any priced row.
    slug: 'ipe-lamborghini-huracan-tecnica-exhaust-system',
    match: () => 7600,
  },
  {
    // Porsche Cayenne 2.9T (E3) — DB Full System / Catback both at $6,400.
    // Full System = Cat-back ($6,400) + Catted Downpipe ($4,300, Bilateral
    // version) = $10,700. Catback alone stays $6,400.
    slug: 'ipe-porsche-cayenne-cayenne-coupe-e3-exhaust',
    match: (v) => /full\s*system/i.test(v.option2Value ?? '') ? 10700 : /catback/i.test(v.option2Value ?? '') ? 6400 : null,
  },
];

(async () => {
  for (const m of MAPPINGS) {
    const product = await prisma.shopProduct.findFirst({
      where: { slug: m.slug },
      include: { variants: true },
    });
    if (!product) {
      console.log(`  not found: ${m.slug}`);
      continue;
    }
    console.log(`\n[${m.slug}]`);
    for (const v of product.variants) {
      const target = m.match(v);
      if (target == null) {
        console.log(`  skip: ${v.option1Value} / ${v.option2Value}`);
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
  }
  console.log(APPLY ? '\n(applied)' : '\n(dry-run — pass --apply)');
  await prisma.$disconnect();
})();
