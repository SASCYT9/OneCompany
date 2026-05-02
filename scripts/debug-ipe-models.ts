import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
import { resolveIpeVehicleBrand, resolveIpeVehicleModel } from '@/lib/ipeCatalog';
const p = new PrismaClient();
(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: 'iPE', mode: 'insensitive' } },
    include: { variants: true, metafields: true },
  });
  // Look for the suspicious models
  const suspicious = ['lambo', 'header-back', 'AMG W465 G63', 'C63'];
  for (const susp of suspicious) {
    console.log(`\n=== '${susp}' ===`);
    for (const product of products) {
      const model = resolveIpeVehicleModel(product as any);
      if (model === susp) {
        const brand = resolveIpeVehicleBrand(product as any);
        console.log(`  slug: ${product.slug}`);
        console.log(`    brand: ${brand}  model: ${model}`);
        console.log(`    title: ${(product.title as any)?.en}`);
        console.log(`    tags: ${(product.tags ?? []).join(' | ')}`);
        console.log(`    collection: ${(product.collection as any)?.en}`);
      }
    }
  }
  await p.$disconnect();
})();
