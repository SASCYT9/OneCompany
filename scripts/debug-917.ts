import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const r = await p.shopProduct.findFirst({
    where: { sku: '917056-5002S' },
    select: { sku: true, slug: true, brand: true, isPublished: true, status: true, stock: true, priceEur: true, categoryEn: true, titleEn: true, tags: true, collectionEn: true,
      variants: { select: { sku: true, priceEur: true, inventoryQty: true } } }
  });
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
})();
