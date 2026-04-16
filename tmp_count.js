const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prods = await prisma.shopProduct.findMany({
    where: { OR: [{vendor:{contains:'urban',mode:'insensitive'}},{brand:{contains:'urban',mode:'insensitive'}}] },
    select: {titleEn:true, titleUa:true},
  });
  
  const broken = prods.filter(x => x.titleEn && /[а-яіїєґ]/i.test(x.titleEn));
  const fixed = prods.filter(x => x.titleEn && !/[а-яіїєґ]/i.test(x.titleEn) && x.titleEn !== x.titleUa);
  const same = prods.filter(x => x.titleEn === x.titleUa && !/[а-яіїєґ]/i.test(x.titleEn));
  
  console.log('Total:', prods.length);
  console.log('Fixed (EN is now English):', fixed.length);
  console.log('Still broken (EN has Cyrillic):', broken.length);
  console.log('Same EN=UA (both English):', same.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
