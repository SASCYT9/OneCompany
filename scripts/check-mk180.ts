import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const r = await p.shopProduct.findFirst({
    where: { sku: 'MK-180' },
    select: { sku: true, slug: true, titleEn: true, categoryEn: true, isPublished: true, priceEur: true, tags: true }
  });
  console.log(r);
  await p.$disconnect();
})();
