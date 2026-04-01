import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const prisma = new PrismaClient();

async function run() {
  console.log('=== Enriching LOCAL variants with Turn14 Dimensions ===');

  // Fetch all variants that are currently missing dimensions
  const variants = await prisma.shopProductVariant.findMany({
    where: {
      OR: [
        { weight: null },
        { length: null },
        { width: null },
        { height: null },
      ]
    }
  });

  console.log(`🔎 Found ${variants.length} local variants missing some dimensions.`);

  let updated = 0;

  for (const variant of variants) {
    if (!variant.sku) continue;

    // Search Turn14 cache for this SKU
    const t14Item = await prisma.turn14CatalogItem.findFirst({
      where: {
        OR: [
          { partNumber: variant.sku },
          { mfrPartNumber: variant.sku }
        ]
      }
    });

    if (t14Item) {
      const attrs = t14Item.rawAttributes || {};
      const dim = attrs.dimensions?.[0] || {};
      
      const newWeight = t14Item.weight || dim.weight || null;
      const newLength = dim.length || null;
      const newWidth = dim.width || null;
      const newHeight = dim.height || null;

      if (newWeight || newLength || newWidth || newHeight) {
        await prisma.shopProductVariant.update({
          where: { id: variant.id },
          data: {
            weight: newWeight ? Number(newWeight) : variant.weight,
            length: newLength ? Number(newLength) : variant.length,
            width: newWidth ? Number(newWidth) : variant.width,
            height: newHeight ? Number(newHeight) : variant.height,
            isDimensionsEstimated: false,
          }
        });
        updated++;
        process.stdout.write(`\r✅ Updated: ${updated}`);
      }
    }
  }

  console.log(`\n🎉 Finished! Enriched ${updated} local variants with exact Turn14 dimensions.`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
