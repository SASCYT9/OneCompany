import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get a full sample Brabus image URL
  const brabusSample = await prisma.shopProduct.findFirst({
    where: { brand: 'Brabus', image: { not: null } },
    select: { slug: true, image: true },
  });
  console.log('Brabus sample image:', brabusSample?.image);

  // Get a full sample DO88 image URL
  const do88Sample = await prisma.shopProduct.findFirst({
    where: { brand: 'DO88', image: { not: null } },
    select: { slug: true, image: true },
  });
  console.log('DO88 sample image:', do88Sample?.image);

  // Get a full sample Burger image URL
  const burgerSample = await prisma.shopProduct.findFirst({
    where: { brand: 'Burger Motorsports', image: { not: null } },
    select: { slug: true, image: true },
  });
  console.log('Burger sample image:', burgerSample?.image);

  // Get a full sample RaceChip image URL
  const racechipSample = await prisma.shopProduct.findFirst({
    where: { brand: 'RaceChip', image: { not: null } },
    select: { slug: true, image: true },
  });
  console.log('RaceChip sample image:', racechipSample?.image);
}

main().finally(() => prisma.$disconnect());
