import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  const result = await prisma.shopProduct.findMany({
    where: { 
      OR: [
        { brand: { contains: 'do88', mode: 'insensitive' } },
        { vendor: { contains: 'do88', mode: 'insensitive' } }
      ]
    },
    select: { 
      slug: true, 
      sku: true, 
      image: true, 
      brand: true,
      _count: { select: { media: true } } 
    },
    take: 5 
  });
  console.log(`Checking DO88 case insensitive... Found ${result.length} products to sample.`);
  console.dir(result, { depth: null });
  
  const total = await prisma.shopProduct.count({
    where: { OR: [ { brand: { contains: 'do88', mode: 'insensitive' } }, { vendor: { contains: 'do88', mode: 'insensitive' } } ] }
  });
  console.log(`Total DO88 products in DB: ${total}`);
}
main().finally(() => prisma.$disconnect());
