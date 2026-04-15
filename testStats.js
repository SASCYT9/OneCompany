const { PrismaClient } = require('@prisma/client');
async function main() {
    const prisma = new PrismaClient();
    const categories = await prisma.shopProduct.groupBy({
        by: ['categoryId'],
        _count: { id: true }
    });
    console.log('Categories count:');
    categories.forEach(c => console.log(c.categoryId + ': ' + c._count.id));
    await prisma.$disconnect();
}
main().catch(console.error);
