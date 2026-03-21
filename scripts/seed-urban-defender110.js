require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const handle = 'land-rover-defender-110';
  const heroImage =
    'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp';

  const collection = await prisma.shopCollection.upsert({
    where: { handle },
    create: {
      handle,
      titleUa: 'Defender 110',
      titleEn: 'Defender 110',
      brand: 'Land Rover',
      isUrban: true,
      isPublished: true,
      sortOrder: 0,
      heroImage,
    },
    update: {
      titleUa: 'Defender 110',
      titleEn: 'Defender 110',
      brand: 'Land Rover',
      isUrban: true,
      isPublished: true,
      heroImage,
    },
  });

  const products = [
    {
      slug: 'urban-defender-110-aerokit',
      sku: 'URB-DEF110-AERO',
      titleUa: 'Urban Aerokit — Defender 110',
      titleEn: 'Urban Aerokit — Defender 110',
      shortDescUa: 'Комплект аеродинамічного обвісу Urban Automotive для Defender 110.',
      shortDescEn: 'Urban Automotive aerokit package for Defender 110.',
      priceEur: 4990,
      priceUsd: 5390,
      priceUah: 219000,
      image:
        'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/defender2020Plus/2025Updates/hero-1-1920.jpg',
    },
    {
      slug: 'urban-defender-110-wide-arches',
      sku: 'URB-DEF110-ARCH',
      titleUa: 'Wide Arches — Defender 110',
      titleEn: 'Wide Arches — Defender 110',
      shortDescUa: 'Розширення арок та візуальний пакет для Defender 110.',
      shortDescEn: 'Wide arches & visual package for Defender 110.',
      priceEur: 2750,
      priceUsd: 2990,
      priceUah: 121000,
      image:
        'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-3-2560.webp',
    },
    {
      slug: 'urban-defender-110-roof-lightbar',
      sku: 'URB-DEF110-LIGHT',
      titleUa: 'Roof Lightbar — Defender 110',
      titleEn: 'Roof Lightbar — Defender 110',
      shortDescUa: 'Світлова балка на дах для Defender 110.',
      shortDescEn: 'Roof-mounted lightbar for Defender 110.',
      priceEur: 990,
      priceUsd: 1090,
      priceUah: 45000,
      image:
        'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-5-2560.webp',
    },
  ];

  for (const p of products) {
    const product = await prisma.shopProduct.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        sku: p.sku,
        scope: 'auto',
        brand: 'Urban Automotive',
        vendor: 'Urban Automotive',
        productType: 'Urban',
        tags: ['urban', 'defender-110', 'land-rover'],
        status: 'ACTIVE',
        titleUa: p.titleUa,
        titleEn: p.titleEn,
        shortDescUa: p.shortDescUa,
        shortDescEn: p.shortDescEn,
        stock: 'preOrder',
        collectionUa: 'Urban',
        collectionEn: 'Urban',
        priceEur: p.priceEur,
        priceUsd: p.priceUsd,
        priceUah: p.priceUah,
        image: p.image,
        isPublished: true,
        publishedAt: new Date(),
      },
      update: {
        sku: p.sku,
        titleUa: p.titleUa,
        titleEn: p.titleEn,
        shortDescUa: p.shortDescUa,
        shortDescEn: p.shortDescEn,
        priceEur: p.priceEur,
        priceUsd: p.priceUsd,
        priceUah: p.priceUah,
        image: p.image,
        isPublished: true,
      },
    });

    await prisma.shopProductCollection.upsert({
      where: {
        productId_collectionId: {
          productId: product.id,
          collectionId: collection.id,
        },
      },
      create: {
        productId: product.id,
        collectionId: collection.id,
        sortOrder: 0,
      },
      update: {
        sortOrder: 0,
      },
    });
  }

  console.log(`Seeded Urban collection ${handle} with ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

