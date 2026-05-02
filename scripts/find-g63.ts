import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: 'iPE', mode: 'insensitive' }, OR: [{ slug: { contains: 'g63' } }, { slug: { contains: 'g500' } }, { slug: { contains: 'c63' } }] },
  });
  for (const r of products) {
    console.log(`\n${r.slug}`);
    console.log(`  title.en: ${(r.title as any)?.en}`);
    console.log(`  tags: ${(r.tags ?? []).join(' | ')}`);
  }
  await p.$disconnect();
})();
