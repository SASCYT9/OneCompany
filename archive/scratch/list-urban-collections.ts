import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const collections = await prisma.shopCollection.findMany({
    where: {
      OR: [
        { brand: 'Urban' },
        { isUrban: true }
      ]
    },
    include: {
      _count: {
        select: { products: true }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  console.log(`Found ${collections.length} Urban collections in DB:`);
  collections.forEach(c => {
    console.log(`- ID: ${c.id}\n  Handle: ${c.handle}\n  Title UA: ${c.titleUa} | Title EN: ${c.titleEn}\n  Products Count: ${c._count.products}\n  Sort Order: ${c.sortOrder}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
