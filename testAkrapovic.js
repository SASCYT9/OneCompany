const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { 
      titleEn: { contains: 'Test' }
    }
  });
  console.log('Test Count:', products.length);
  for (let p of products) {
    if (p.brand === 'Akrapovic' || p.brand === 'Akrapovic') {
        await prisma.shopProduct.delete({ where: { id: p.id } });
        console.log('Deleted', p.titleEn);
    }
  }
}
main().finally(() => prisma.$disconnect());
