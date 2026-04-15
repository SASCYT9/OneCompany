import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAudit() {
  const products = await prisma.shopProduct.findMany({
    where: { longDescEn: { not: null } },
    select: { slug: true, titleEn: true, titleUa: true, longDescUa: true, longDescEn: true },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });

  const emptyUa = await prisma.shopProduct.count({ where: { longDescUa: null } });
  const emptyEn = await prisma.shopProduct.count({ where: { longDescEn: null } });
  
  // Find products where UA and EN tags might be identical or corrupted
  const potentialDupes = await prisma.shopProduct.count({
    where: { longDescUa: { equals: prisma.shopProduct.fields.longDescEn } }
  });

  console.log('--- DB LOCALIZATION STATS ---');
  console.log(`Products missing UA: ${emptyUa}`);
  console.log(`Products missing EN: ${emptyEn}`);
  console.log(`Products with identical UA/EN: ${potentialDupes}`);
  
  console.log('\n--- SAMPLE 5 TRANSLATED PRODUCTS ---');
  console.log(JSON.stringify(products.map(p => ({
    title: p.titleEn,
    uaLength: p.longDescUa?.length,
    enLength: p.longDescEn?.length,
    uaPreview: p.longDescUa?.substring(0, 100).replace(/\n/g, ''),
    enPreview: p.longDescEn?.substring(0, 100).replace(/\n/g, '')
  })), null, 2));

  await prisma.$disconnect();
}

runAudit().catch(console.error);
