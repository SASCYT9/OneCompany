const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.shopProduct.findFirst({
    where: { sku: 'ICM-110' },
    select: { image: true }
  });
  console.log(p);
  const p2 = await prisma.shopProduct.findFirst({
    where: { sku: 'WRC-330' },
    select: { image: true }
  });
  console.log(p2);
}
main().finally(() => prisma.$disconnect());
