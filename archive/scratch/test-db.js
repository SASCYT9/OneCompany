const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const v = await prisma.shopProductVariant.findFirst({
    where: { sku: { contains: '25358150' } }
  });
  console.log(v);
}
main().finally(() => prisma.$disconnect());
