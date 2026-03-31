/**
 * Fix DO88 image URLs in the database.
 * 
 * Old format (404): /bilder/artiklar/stor/SKU_1.jpg
 * New format (200): /bilder/artiklar/liten/SKU_S.jpg
 * 
 * Updates all DO88 products to use the new working URL format.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'https://www.do88.se';

async function main() {
  console.log('🔧 DO88 Image URL Fixer\n');

  // Get all DO88 products with images
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: 'DO88',
      image: { not: null },
      NOT: { image: '' },
    },
    select: { id: true, sku: true, slug: true, image: true },
  });

  console.log(`Found ${products.length} DO88 products with images\n`);

  let fixed = 0;
  let alreadyOk = 0;
  let noSku = 0;

  // Batch update: transform old URL pattern to new one
  const updates: { id: string; newImage: string }[] = [];

  for (const p of products) {
    if (!p.sku) {
      noSku++;
      continue;
    }

    const oldImage = p.image || '';
    
    // If already using the new format, skip
    if (oldImage.includes('_S.jpg')) {
      alreadyOk++;
      continue;
    }

    // Build new URL: /bilder/artiklar/liten/{SKU}_S.jpg
    const newImage = `${BASE}/bilder/artiklar/liten/${p.sku}_S.jpg`;
    updates.push({ id: p.id, newImage });
  }

  console.log(`Updating ${updates.length} products...`);

  // Execute in batches of 50 for performance
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ id, newImage }) =>
        prisma.shopProduct.update({
          where: { id },
          data: { image: newImage },
        })
      )
    );
    fixed += batch.length;
    process.stdout.write(`  Updated ${fixed}/${updates.length}\r`);
  }

  // Also update ShopProductMedia if it exists
  const mediaUpdates = await prisma.shopProductMedia.findMany({
    where: {
      product: { brand: 'DO88' },
      src: { contains: '_1.jpg' },
    },
    select: { id: true, src: true, product: { select: { sku: true } } },
  });

  let mediaFixed = 0;
  for (const m of mediaUpdates) {
    if (m.product.sku) {
      const newSrc = `${BASE}/bilder/artiklar/liten/${m.product.sku}_S.jpg`;
      await prisma.shopProductMedia.update({
        where: { id: m.id },
        data: { src: newSrc },
      });
      mediaFixed++;
    }
  }

  // Also update variant images
  const variantUpdates = await prisma.shopProductVariant.findMany({
    where: {
      product: { brand: 'DO88' },
      image: { contains: '_1.jpg' },
    },
    select: { id: true, image: true, sku: true },
  });

  let variantFixed = 0;
  for (const v of variantUpdates) {
    if (v.sku) {
      const newImage = `${BASE}/bilder/artiklar/liten/${v.sku}_S.jpg`;
      await prisma.shopProductVariant.update({
        where: { id: v.id },
        data: { image: newImage },
      });
      variantFixed++;
    }
  }

  console.log(`\n\n📊 Results:`);
  console.log(`  Products updated: ${fixed}`);
  console.log(`  Already correct:  ${alreadyOk}`);
  console.log(`  No SKU (skipped): ${noSku}`);
  console.log(`  Media fixed:      ${mediaFixed}`);
  console.log(`  Variants fixed:   ${variantFixed}`);
}

main()
  .then(() => console.log('\n✅ Done!'))
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
