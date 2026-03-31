import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  const count = await prisma.shopProduct.count({
    where: { brand: 'Brabus', tags: { hasSome: ['Mercedes', 'Porsche', 'Rolls-Royce', 'smart', 'Range Rover', 'Bentley', 'Lamborghini'] } }
  });
  console.log(`Brabus products with injected tags: ${count}`);
}
main().finally(() => prisma.$disconnect());
