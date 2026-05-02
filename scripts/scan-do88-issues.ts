import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  // 1) Find any DO88 product with "Додатковий радіатор" in any text field
  const dodatkovyy = await prisma.shopProduct.findMany({
    where: {
      AND: [
        { brand: { equals: 'DO88', mode: 'insensitive' } },
        { OR: [
          { titleUa: { contains: 'Додатковий радіатор', mode: 'insensitive' } },
          { categoryUa: { contains: 'Додатковий', mode: 'insensitive' } },
          { collectionUa: { contains: 'Додатковий', mode: 'insensitive' } },
          { shortDescUa: { contains: 'Додатковий радіатор', mode: 'insensitive' } },
          { bodyHtmlUa: { contains: 'Додатковий радіатор', mode: 'insensitive' } },
        ]},
      ],
    },
    select: { id: true, slug: true, sku: true, titleUa: true, titleEn: true, categoryUa: true, collectionUa: true },
    take: 50,
  });
  console.log(`\n[DODATKOVYY] DO88 products mentioning "Додатковий радіатор": ${dodatkovyy.length}`);
  dodatkovyy.forEach(p => console.log(' ', p.sku, '|', p.titleUa, '| col:', p.collectionUa, '| cat:', (p.categoryUa||'').slice(0,60)));

  // 2) RS6 products + prices
  const rs6 = await prisma.shopProduct.findMany({
    where: {
      AND: [
        { brand: { equals: 'DO88', mode: 'insensitive' } },
        { OR: [
          { titleEn: { contains: 'RS6', mode: 'insensitive' } },
          { titleEn: { contains: 'RS7', mode: 'insensitive' } },
          { categoryEn: { contains: 'RS6', mode: 'insensitive' } },
        ]},
      ],
    },
    select: { id: true, slug: true, sku: true, titleEn: true, priceEur: true, variants: { select: { sku: true, priceEur: true } } },
    take: 30,
  });
  console.log(`\n[RS6/RS7] DO88 products: ${rs6.length}`);
  rs6.forEach(p => {
    const vP = p.variants.map(v => `${v.sku}=${v.priceEur}`).join(', ');
    console.log(' ', p.sku, '€'+p.priceEur, '|', p.titleEn?.slice(0,70), '| variants:', vP);
  });

  // 3) 992 Turbo products
  const turbo992 = await prisma.shopProduct.findMany({
    where: {
      AND: [
        { brand: { equals: 'DO88', mode: 'insensitive' } },
        { OR: [
          { titleEn: { contains: '992', mode: 'insensitive' } },
          { categoryEn: { contains: '992', mode: 'insensitive' } },
          { tags: { has: '992' } },
        ]},
      ],
    },
    select: { id: true, slug: true, sku: true, titleEn: true, categoryEn: true, priceEur: true },
    take: 30,
  });
  console.log(`\n[992] DO88 products with 992 in fields: ${turbo992.length}`);
  turbo992.forEach(p => console.log(' ', p.sku, '€'+p.priceEur, '|', p.titleEn?.slice(0,60), '| cat:', p.categoryEn?.slice(0,80)));

  // 4) Total count
  const total = await prisma.shopProduct.count({ where: { brand: { equals: 'DO88', mode: 'insensitive' } } });
  console.log(`\n[TOTAL] DO88 products in DB: ${total}`);

  // 5) Count by collectionUa to see if "Додатковий радіатор" surfaces
  const byCol = await prisma.shopProduct.groupBy({
    by: ['collectionUa'],
    where: { brand: { equals: 'DO88', mode: 'insensitive' } },
    _count: true,
  });
  console.log(`\n[COLLECTIONS UA] count:`);
  byCol.sort((a,b)=>b._count-a._count).forEach(c => console.log(' ', c._count, c.collectionUa));
}
main().finally(() => prisma.$disconnect());
