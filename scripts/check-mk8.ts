import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const r = await p.shopProduct.findMany({
    where: {
      brand: { equals: 'DO88', mode: 'insensitive' },
      categoryEn: { contains: 'Mk 8 MQB Evo', mode: 'insensitive' }
    },
    select: { sku: true, slug: true, categoryEn: true, isPublished: true, priceEur: true }
  });
  console.log('Mk8 products in DB:', r.length);
  r.forEach(x => console.log(' ', x.sku, '€'+x.priceEur, 'pub='+x.isPublished, 'cat:', x.categoryEn?.slice(0,80)));
  await p.$disconnect();
})();
