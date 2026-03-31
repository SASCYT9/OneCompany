import { PrismaClient } from '@prisma/client';

async function checkDb() {
  const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:postgres@localhost:5433/onecompany?schema=public'
  });
  const productsCount = await prisma.shopProduct.count();
  const variantsCount = await prisma.shopProductVariant.count();
  const burgerCount = await prisma.shopProduct.count({ where: { vendor: { contains: 'Burger' } } });
  const do88Count = await prisma.shopProduct.count({ where: { vendor: { contains: 'do88' } } });
  const brabusCount = await prisma.shopProduct.count({ where: { vendor: { contains: 'Brabus' } } });

  console.log('--- LOCAL DOCKER DB STATUS ---');
  console.log(`Total Products: ${productsCount}`);
  console.log(`Total Variants: ${variantsCount}`);
  console.log(`Burger Products: ${burgerCount}`);
  console.log(`do88 Products: ${do88Count}`);
  console.log(`Brabus Products: ${brabusCount}`);
  await prisma.$disconnect();
}

checkDb().catch(console.error);
