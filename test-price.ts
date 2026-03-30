import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.shopProduct.findUnique({
    where: { slug: 'brabus-f14-257-pe' },
    include: { variants: true }
  });
  console.log(JSON.stringify(p, null, 2));
}

main().finally(() => prisma.$disconnect());
