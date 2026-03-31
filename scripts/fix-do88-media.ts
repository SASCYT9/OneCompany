import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'https://www.do88.se';

async function main() {
  // Fix media records
  const mediaCount = await prisma.shopProductMedia.updateMany({
    where: {
      product: { brand: 'DO88' },
      src: { contains: '_1.jpg' },
    },
    data: {},  // Can't mass-update with computed values, need individual updates
  });

  // Get all DO88 media that need fixing
  const media = await prisma.shopProductMedia.findMany({
    where: {
      product: { brand: 'DO88' },
      src: { contains: '/stor/' },
    },
    select: { id: true, src: true, product: { select: { sku: true } } },
  });

  console.log(`Fixing ${media.length} media records...`);
  
  const mediaBatch = media.map(m => {
    const newSrc = `${BASE}/bilder/artiklar/liten/${m.product.sku}_S.jpg`;
    return prisma.shopProductMedia.update({
      where: { id: m.id },
      data: { src: newSrc },
    });
  });

  // Execute in chunks of 50
  for (let i = 0; i < mediaBatch.length; i += 50) {
    await Promise.all(mediaBatch.slice(i, i + 50));
    console.log(`  Media: ${Math.min(i + 50, mediaBatch.length)}/${mediaBatch.length}`);
  }

  // Get all DO88 variants that need fixing
  const variants = await prisma.shopProductVariant.findMany({
    where: {
      product: { brand: 'DO88' },
      image: { contains: '/stor/' },
    },
    select: { id: true, image: true, sku: true },
  });

  console.log(`Fixing ${variants.length} variant records...`);
  
  const variantBatch = variants.map(v => {
    const newImage = `${BASE}/bilder/artiklar/liten/${v.sku}_S.jpg`;
    return prisma.shopProductVariant.update({
      where: { id: v.id },
      data: { image: newImage },
    });
  });

  for (let i = 0; i < variantBatch.length; i += 50) {
    await Promise.all(variantBatch.slice(i, i + 50));
    console.log(`  Variants: ${Math.min(i + 50, variantBatch.length)}/${variantBatch.length}`);
  }

  console.log('\n✅ Done!');
}

main().finally(() => prisma.$disconnect());
