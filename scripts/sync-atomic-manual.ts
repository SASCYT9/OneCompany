import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Atomic Shop CSV Sync (Manual Script)');
  const feedUrl = 'https://feed.atomic-shop.ua/feed_tts.csv';

  console.log(`Downloading feed from ${feedUrl}...`);
  const req = await fetch(feedUrl);
  if (!req.ok) {
    throw new Error(`HTTP Error Status: ${req.status}`);
  }

  const csvText = await req.text();
  console.log('Parsing CSV...');
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as any[];
  console.log(`📦 Loaded ${rows.length} products from feed.`);

  let updatedCount = 0;
  let notFoundCount = 0;
  let createdCount = 0;

  console.log('Synchronizing inventory with DB (this might take a few moments)...');

  function generateSlug(brand: string, sku: string): string {
    return `${brand.toLowerCase()}-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
  }

  // Process rows sequentially to avoid overwhelming connection pool
  for (const row of rows) {
    if (!row.mpn || !row.brand) continue;

    const mpn = String(row.mpn).trim();
    const brand = String(row.brand).trim();
    const stockVal = parseInt(row.stock || '0', 10);
    const title = row.title || `${brand} ${mpn}`;
    const description = row.description || null;
    const categoryName = row.category || null;
    const imgLink = row.img_link || null;

    const rawPrice = row.price_uah || row.price || row.rrp;
    const priceUah = rawPrice ? parseFloat(rawPrice) : undefined;

    const variants = await prisma.shopProductVariant.findMany({
      where: {
        sku: mpn,
        product: {
          brand: {
            equals: brand,
            mode: 'insensitive',
          }
        }
      },
    });

    if (variants.length > 0) {
      for (const variant of variants) {
        await prisma.shopProductVariant.update({
          where: { id: variant.id },
          data: { 
            inventoryQty: isNaN(stockVal) ? 0 : stockVal,
            ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah })
          },
        });

        await prisma.shopProduct.update({
          where: { id: variant.productId },
          data: { 
            stock: stockVal > 0 ? 'inStock' : 'outOfStock',
            ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah })
          }
        });
      }
      updatedCount++;
      if ((updatedCount + createdCount) % 100 === 0) {
        process.stdout.write(`.` );
      }
    } else {
      // Product not found, create new one
      const slug = generateSlug(brand, mpn);
      
      // Ensure slug uniqueness (basic check)
      const existingSlug = await prisma.shopProduct.findUnique({ where: { slug } });
      const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

      await prisma.shopProduct.create({
        data: {
          slug: finalSlug,
          sku: mpn,
          brand,
          scope: 'auto',
          isPublished: true,
          status: 'ACTIVE',
          stock: stockVal > 0 ? 'inStock' : 'outOfStock',
          titleUa: title,
          titleEn: title,
          seoTitleUa: title,
          seoTitleEn: title,
          bodyHtmlUa: description,
          bodyHtmlEn: description,
          longDescUa: description,
          longDescEn: description,
          seoDescriptionUa: description ? String(description).replace(/<[^>]+>/g, '').slice(0, 300) : null,
          seoDescriptionEn: description ? String(description).replace(/<[^>]+>/g, '').slice(0, 300) : null,
          categoryUa: categoryName,
          categoryEn: categoryName,
          productCategory: categoryName,
          image: imgLink,
          ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
          variants: {
            create: [{
              title: title,
              sku: mpn,
              position: 1,
              inventoryQty: isNaN(stockVal) ? 0 : stockVal,
              requiresShipping: true,
              image: imgLink,
              isDefault: true,
              ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
            }]
          },
          media: imgLink ? {
            create: [{
              src: imgLink,
              altText: title,
              position: 1,
              mediaType: 'IMAGE'
            }]
          } : undefined
        }
      });
      createdCount++;
      if ((updatedCount + createdCount) % 100 === 0) {
        process.stdout.write(`.` );
      }
    }
  }

  console.log(`\n🎉 Sync Complete!`);
  console.log(`   Updated Existing: ${updatedCount}`);
  console.log(`   Created New:      ${createdCount}`);
  // notFoundCount is effectively createdCount now
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Sync Failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
