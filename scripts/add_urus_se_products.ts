import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { syncUrbanCollectionAssignments } from '../src/lib/shopAdminCollections';

const prisma = new PrismaClient();

async function addUrusSEProducts() {
  try {
    console.log('Fetching Urban Urus SE products from GP Portal...');

    const [mirrorData, wideData] = await Promise.all([
      fetch('https://gp-portal.eu/products/urb-mir-26054211-v1.js').then((r) => r.json()),
      fetch('https://gp-portal.eu/products/urb-wid-26084234-v1.js').then((r) => r.json()),
    ]);

    const productsToInsert = [
      {
        slug: 'lamborghini-urus-se-wing-mirror-caps-visual-carbon-fibre-adas',
        sku: 'URB-MIR-26054211-V1',
        titleEn: mirrorData.title,
        titleUa: 'Lamborghini Urus SE Накладки на дзеркала з візуального карбону (Adas)',
        brand: 'Urban',
        scope: 'auto',
        image:
          mirrorData.featured_image ||
          (mirrorData.images && mirrorData.images[0]) ||
          'https://gp-portal.eu/cdn/shop/files/Urus-Carbon-Mirror-Covers_84319dd6-9815-4ba5-a86d-ae9f6eebcaaf.jpg',
        gallery: mirrorData.images || [],
        priceEur: mirrorData.price / 100 * 1.2,
        isPublished: true,
        collectionEn: 'Lamborghini Urus SE',
        collectionUa: 'Lamborghini Urus SE',
        shortDescEn: 'Visual carbon fiber construction with authentic weave pattern. Direct replacement fitment for Urus SE.',
        shortDescUa: 'Конструкція з візуального карбону з автентичним візерунком. Пряма заміна для Urus SE.',
        bodyHtmlEn: mirrorData.description || '',
        stock: 'inStock',
        tags: ['Urus SE', 'Carbon Fibre', 'Mirrors', 'Urban Automotive'],
      },
      {
        slug: 'lamborghini-urus-se-urban-widetrack-kit',
        sku: 'URB-WID-26084234-V1',
        titleEn: wideData.title,
        titleUa: 'Lamborghini Urus SE Аеродинамічний комплект Urban Widetrack',
        brand: 'Urban',
        scope: 'auto',
        image:
          wideData.featured_image ||
          (wideData.images && wideData.images[0]) ||
          'https://gp-portal.eu/cdn/shop/files/urus-se-widetrack.jpg',
        gallery: wideData.images || [],
        priceEur: wideData.price / 100 * 1.2,
        isPublished: true,
        collectionEn: 'Lamborghini Urus SE',
        collectionUa: 'Lamborghini Urus SE',
        shortDescEn: 'Complete Urban Widetrack aerodynamic kit for Lamborghini Urus SE.',
        shortDescUa: 'Повний аеродинамічний комплект Urban Widetrack для Lamborghini Urus SE.',
        bodyHtmlEn: wideData.description || '',
        stock: 'inStock',
        tags: ['Urus SE', 'Widetrack', 'Bodykit', 'Urban Automotive'],
      },
    ];

    for (const data of productsToInsert) {
      console.log(`Upserting ${data.sku} - ${data.titleEn}...`);
      
      const product = await prisma.shopProduct.upsert({
        where: { slug: data.slug },
        update: {
          priceEur: data.priceEur,
          titleEn: data.titleEn,
          titleUa: data.titleUa,
          image: data.image,
          gallery: data.gallery,
        },
        create: {
          slug: data.slug,
          sku: data.sku,
          titleEn: data.titleEn,
          titleUa: data.titleUa,
          brand: data.brand,
          scope: data.scope,
          image: data.image,
          gallery: data.gallery,
          priceEur: data.priceEur,
          isPublished: data.isPublished,
          collectionEn: data.collectionEn,
          collectionUa: data.collectionUa,
          shortDescEn: data.shortDescEn,
          shortDescUa: data.shortDescUa,
          bodyHtmlEn: data.bodyHtmlEn,
          bodyHtmlUa: data.bodyHtmlEn, // fallback to English description
          stock: data.stock,
          tags: data.tags,
          variants: {
            create: {
              title: 'Default Title',
              sku: data.sku,
              priceEur: data.priceEur,
              inventoryQty: 10,
              isDefault: true,
              position: 1,
            },
          },
        },
      });

      console.log(`Inserted product ID: ${product.id}`);
    }

    console.log('Syncing Urban Collection Assignments...');
    const syncResult = await syncUrbanCollectionAssignments(prisma);
    console.log('Sync Result:', syncResult);

  } catch (error) {
    console.error('Failed to add products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addUrusSEProducts();
