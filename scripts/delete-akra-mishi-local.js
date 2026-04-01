const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // 1. Show what we're about to delete
  const items = await p.shopProduct.findMany({
    where: { brand: { in: ['Akrapovic', 'Mishimoto'], mode: 'insensitive' } },
    select: { id: true, slug: true, brand: true, titleEn: true }
  });

  console.log('🗑️  Products to delete from LOCAL ShopProduct:');
  items.forEach(x => console.log(`   - [${x.brand}] ${x.titleEn} (${x.slug})`));
  console.log(`   Total: ${items.length}\n`);

  // 2. Delete variants first (FK constraint), then products
  const ids = items.map(x => x.id);
  
  const delVariants = await p.shopProductVariant.deleteMany({ where: { productId: { in: ids } } });
  console.log(`   Deleted ${delVariants.count} variants`);

  const delMedia = await p.shopProductMedia.deleteMany({ where: { productId: { in: ids } } });
  console.log(`   Deleted ${delMedia.count} media`);

  const delProducts = await p.shopProduct.deleteMany({ where: { id: { in: ids } } });
  console.log(`   Deleted ${delProducts.count} products`);

  console.log('\n✅ Done! Akrapovic & Mishimoto removed from LOCAL shop.');
}

run().catch(console.error).finally(() => p.$disconnect());
