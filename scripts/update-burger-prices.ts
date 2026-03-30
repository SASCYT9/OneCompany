import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
// Run with: npx tsx scripts/update-burger-prices.ts

async function main() {
  console.log('🔄 Starting Burger Motorsports Price Update...');

  // 1. Fetch all Burger Motorsports products
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    include: { variants: true },
  });

  console.log(`Found ${products.length} Burger Motorsports products in DB.`);

  let updatedCount = 0;

  for (const product of products) {
    // Check if it's a JB4 Tuner
    const isJb4 = product.tags.some(t => 
      t === 'type:jb4-tuners' || 
      t === 'type:jb-plus-tuners' || 
      t === 'type:stage-1-tuners'
    );

    if (!isJb4) {
      // 1. Store the original price in a Metafield so admin can see it
      const originalPrice = product.priceUsd ? product.priceUsd.toString() : '0';
      
      // Upsert Metafield
      await prisma.shopProductMetafield.upsert({
        where: {
          productId_namespace_key: {
            productId: product.id,
            namespace: 'admin_data',
            key: 'original_cost_usd'
          }
        },
        update: { value: originalPrice },
        create: {
          productId: product.id,
          namespace: 'admin_data',
          key: 'original_cost_usd',
          value: originalPrice,
          valueType: 'number_decimal'
        }
      });

      // 2. Set public price to null (which triggers "Price on Request" on Storefront)
      await prisma.shopProduct.update({
        where: { id: product.id },
        data: { priceUsd: null }
      });

      // 3. Update all variants to null as well
      for (const variant of product.variants) {
        await prisma.shopProductVariant.update({
          where: { id: variant.id },
          data: { priceUsd: null }
        });
      }

      updatedCount++;
    }
  }

  console.log(`✅ Completed! Updated ${updatedCount} non-JB4 products to "Price on Request" (priceUsd = null).`);
  console.log('Original prices were successfully backed up to Metafields (admin_data.original_cost_usd).');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
