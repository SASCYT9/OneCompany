import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: 'iPE', mode: 'insensitive' } },
    include: {
      variants: true,
      media: true,
      metafields: { where: { key: 'gallery_image_materials' } },
    },
    orderBy: { slug: 'asc' },
  });
  const todo = products.filter((r) => {
    if (r.variants.length < 2) return false;
    if (r.metafields.length > 0) return false;
    const imgs = new Set(r.variants.map((v) => v.image ?? ''));
    return imgs.size > 1;
  });
  console.log('TODO:', todo.length);
  for (const r of todo) {
    const ax = r.variants.filter((v) => v.option3Value).length > 0 ? 3 : r.variants.filter((v) => v.option2Value).length > 0 ? 2 : 1;
    console.log(`${r.slug}|${r.media.length}|${r.variants.length}|${ax}`);
  }
  await p.$disconnect();
})();
