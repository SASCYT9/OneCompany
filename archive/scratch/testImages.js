const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const products = await prisma.shopProduct.findMany({
        where: { brand: 'AKRAPOVIC' },
        take: 50
    });
    console.log('Akrapovic products and their images:');
    products.forEach(p => {
        if (p.image) {
            console.log(`ID: ${p.id} | Title: ${p.titleEn.substring(0,40)} | Scope: ${p.scope} | Image: ${p.image}`);
        }
    });
}
main().finally(() => prisma.$disconnect());
