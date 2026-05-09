const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
    const prisma = new PrismaClient();
    const products = await prisma.shopProduct.groupBy({
        by: ['brand'],
        _count: {
            id: true,
        },
    });
    
    products.sort((a,b) => b._count.id - a._count.id);
    
    console.log('Brands found in database:');
    products.forEach(p => console.log(p.brand + ': ' + p._count.id));
    
    // Read brands.ts to figure out which are missing
    const content = fs.readFileSync('./src/lib/brands.ts', 'utf-8');
    const matches = content.match(/name:\s*['"](.*?)['"]/g);
    if (matches) {
        const brandNames = matches.map(m => m.replace(/name:\s*['"]/g, '').replace(/['"]/g, ''));
        console.log('\nMissing in DB from brands.ts:');
        for (const brand of brandNames) {
            const found = products.find(p => p.brand && p.brand.toLowerCase() === brand.toLowerCase());
            // also allow if brand "AKRAPOVIC" matches "Akrapovic"
            const specialFound = products.find(p => 
                p.brand && 
                p.brand.toLowerCase().replace('c','c') === brand.toLowerCase().replace('c','c')
            );
            if (!specialFound && !found) {
                console.log(brand);
            }
        }
    }
    
    await prisma.$disconnect();
}
main().catch(console.error);
