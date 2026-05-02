import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: 'iPE', mode: 'insensitive' }, slug: { contains: 'gt4' } },
  });
  for (const r of products) {
    console.log(`\n${r.slug}`);
    console.log(`  tags: ${(r.tags ?? []).join(' | ')}`);
  }
  await p.$disconnect();
})();
