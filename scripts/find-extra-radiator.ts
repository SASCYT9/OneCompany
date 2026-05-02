import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const r = await prisma.shopProduct.findMany({
    where:{
      AND:[
        { brand: { equals: 'DO88', mode: 'insensitive' } },
        { OR:[
          { titleEn: { contains: 'Extra radiator', mode: 'insensitive' } },
          { titleEn: { contains: 'Extra cooling', mode: 'insensitive' } },
          { titleEn: { contains: 'Extra радіатор', mode: 'insensitive' } },
          { titleUa: { contains: 'Extra радіатор', mode: 'insensitive' } },
          { titleUa: { contains: 'додатковий радіатор', mode: 'insensitive' } },
        ]},
      ],
    },
    select:{ slug:true, sku:true, titleEn:true, titleUa:true },
    take: 20,
  });
  console.log('Found:', r.length);
  r.forEach(p => console.log(`  ${p.slug.padEnd(40)} | en: ${(p.titleEn||'').slice(0,60)} | ua: ${(p.titleUa||'').slice(0,60)}`));
  await prisma.$disconnect();
})();
