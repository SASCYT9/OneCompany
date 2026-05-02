import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const r = await p.shopProduct.findMany({
    where: {
      brand: { equals: 'DO88', mode: 'insensitive' },
      sku: { in: ['ICM-380-S', 'CP-120-1', '917056-5002S', '898199-5001W', '898200-5001W'] }
    },
    select: { sku: true, titleEn: true, titleUa: true, tags: true, categoryEn: true }
  });
  r.forEach(x => {
    console.log(x.sku);
    console.log('  titleEn:', x.titleEn);
    console.log('  titleUa:', x.titleUa);
    console.log('  tags:', x.tags);
    console.log('  cat:', x.categoryEn);
  });
  await p.$disconnect();
})();
