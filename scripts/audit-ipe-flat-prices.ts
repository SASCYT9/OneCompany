import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

(async () => {
  const rows = await p.shopProduct.findMany({
    where: { brand: { contains: 'iPE', mode: 'insensitive' } },
    include: { variants: { orderBy: { position: 'asc' } } },
    orderBy: { slug: 'asc' },
  });
  console.log('iPE products in DB:', rows.length);
  console.log('\n=== Products with all-same-priced variants (suspect: pricing not differentiated) ===');
  for (const r of rows) {
    if (r.variants.length <= 1) continue;
    const priceSet = new Set(r.variants.map((v) => v.priceUsd?.toString() ?? 'null'));
    const optsSet = new Set(
      r.variants.map((v) => [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(' | '))
    );
    if (priceSet.size === 1 && optsSet.size > 1) {
      console.log(`  ${r.slug.padEnd(60)} ${r.variants.length}v @ $${[...priceSet][0]}`);
      for (const v of r.variants.slice(0, 4)) {
        const ov = [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(' / ');
        console.log(`     ${ov}`);
      }
    }
  }
  await p.$disconnect();
})();
