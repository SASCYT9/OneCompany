const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.shopProduct.findMany({
        where: { brand: 'AKRAPOVIC' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, slug: true, titleEn: true, createdAt: true, airtableRecordId: true }
    });
    console.log("Total Akra:", products.length);
    console.log("Most recent 10:");
    console.log(products.slice(0, 10));
}

main().finally(() => prisma.$disconnect());
