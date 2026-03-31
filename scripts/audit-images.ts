import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all brands
  const brands = await prisma.shopProduct.groupBy({
    by: ['brand'],
    _count: true,
  });

  console.log('=== PRODUCT IMAGE AUDIT ===\n');

  for (const b of brands) {
    const brand = b.brand || '(no brand)';
    const total = b._count;

    const withImage = await prisma.shopProduct.count({
      where: {
        brand: b.brand,
        image: { not: null },
        NOT: { image: '' },
      },
    });

    const noImage = total - withImage;

    // Sample image URLs
    const samples = await prisma.shopProduct.findMany({
      where: {
        brand: b.brand,
        image: { not: null },
        NOT: { image: '' },
      },
      select: { slug: true, image: true },
      take: 3,
    });

    // Check media records
    const mediaCount = await prisma.shopProductMedia.count({
      where: { product: { brand: b.brand } },
    });

    console.log(`📦 ${brand}: ${total} products`);
    console.log(`   ├─ With image field: ${withImage}`);
    console.log(`   ├─ No image:        ${noImage}`);
    console.log(`   ├─ Media records:   ${mediaCount}`);
    if (samples.length > 0) {
      console.log(`   └─ Sample URLs:`);
      for (const s of samples) {
        const isLocal = s.image?.startsWith('/');
        const isExternal = s.image?.startsWith('http');
        const type = isLocal ? '📁 LOCAL' : isExternal ? '🌐 EXTERNAL' : '❓ OTHER';
        console.log(`      ${type}: ${s.image?.substring(0, 100)}`);
      }
    }
    console.log('');
  }

  // Check video references
  const videosInMedia = await prisma.shopProductMedia.count({
    where: { mediaType: 'VIDEO' },
  });
  console.log(`\n🎬 Video media records: ${videosInMedia}`);

  // Check if local image paths reference /public or /branding
  const localImageProducts = await prisma.shopProduct.count({
    where: {
      image: { startsWith: '/' },
    },
  });
  console.log(`📁 Products with local path images: ${localImageProducts}`);

  const externalImageProducts = await prisma.shopProduct.count({
    where: {
      image: { startsWith: 'http' },
    },
  });
  console.log(`🌐 Products with external URL images: ${externalImageProducts}`);
}

main().finally(() => prisma.$disconnect());
