const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p1 = await prisma.shopProduct.findMany({
        where: { brand: 'Akrapovic' },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    console.log('Recent Akrapovic:');
    console.table(p1.map(p => ({id: p.id, titleEn: p.titleEn.substring(0,30), brand: p.brand})));
    const p2 = await prisma.shopProduct.findMany({
        where: { brand: 'AKRAPOVIC' },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    console.log('Recent AKRAPOVIC:');
    console.table(p2.map(p => ({id: p.id, titleEn: p.titleEn.substring(0,30), brand: p.brand})));
}
main().finally(() => prisma.$disconnect());
