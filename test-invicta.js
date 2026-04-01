const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const v = await prisma.shopProductVariant.findFirst({
    where: { sku: { contains: '464-INVICTO' } }
  });
  console.log(v);
}
main().finally(() => prisma.$disconnect());
