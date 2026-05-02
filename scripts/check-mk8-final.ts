import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const r = await p.shopProduct.findMany({
    where: { sku: { in: ['ICM-380-S', 'CP-120-1', '917056-5002S', '898199-5001W', '898200-5001W'] } },
    select: { sku: true, slug: true, titleEn: true, tags: true, priceEur: true, categoryEn: true }
  });
  r.forEach(x => console.log(x.sku, '| slug:', x.slug, '| €'+x.priceEur, '| tags:', x.tags.join(',')));
  await p.$disconnect();
})();
