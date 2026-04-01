const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const countBrabus = await prisma.shopProductVariant.count({
    where: { product: { brand: { contains: 'brabus', mode: 'insensitive' } } }
  });
  const countDo88 = await prisma.shopProductVariant.count({
    where: { product: { brand: { contains: 'do88', mode: 'insensitive' } } }
  });
  const countUrban = await prisma.shopProductVariant.count({
    where: { product: { brand: { contains: 'urban', mode: 'insensitive' } } }
  });
  console.log('Brabus Count:', countBrabus);
  console.log('DO88 Count:', countDo88);
  console.log('Urban Count:', countUrban);
}
main().finally(() => prisma.$disconnect());
