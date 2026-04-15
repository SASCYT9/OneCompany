const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('Checking for remaining test products...');
    const allAkra = await prisma.shopProduct.findMany({
        where: { brand: 'Akrapovic' },
        select: { id: true, titleEn: true, titleUa: true }
    });
    let count = 0;
    for (const p of allAkra) {
        if (p.titleEn && p.titleEn.toLowerCase().includes('test')) {
            await prisma.shopProduct.delete({where: {id: p.id}});
            console.log('Deleted Test EN:', p.titleEn);
            count++;
        } else if (p.titleUa && p.titleUa.toLowerCase().includes('test')) {
            await prisma.shopProduct.delete({where: {id: p.id}});
            console.log('Deleted Test UA:', p.titleUa);
            count++;
        }
    }
    console.log('Total deleted:', count);
}
main().finally(() => prisma.$disconnect());
