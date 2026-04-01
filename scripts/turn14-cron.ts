import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { getTurn14AccessToken, findTurn14BrandIdByName, fetchTurn14ItemsByBrand } from '../src/lib/turn14';

dotenv.config({ path: '.env.local' });
const prisma = new PrismaClient();

// Add or remove brands you want to auto-sync!
const BRANDS_TO_SYNC = [
  'Eventuri',
  'KW',
  'Radium Engineering',
  'AWE'
];

function generateHash(item: any): string {
  const str = `${item.id}-${item.attributes.dealer_price}-${item.attributes.price_group}-${item.attributes.regular_stock}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

async function run() {
  console.log(`[Turn14 Cron] Starting catalog sync...`);

  for (const brandName of BRANDS_TO_SYNC) {
    try {
      console.log(`\n[Turn14 Cron] Syncing Brand: ${brandName}`);
      const brandId = await findTurn14BrandIdByName(brandName);
      if (!brandId) {
        console.log(`[Turn14 Cron] Brand "${brandName}" not found in Turn14. Skipping.`);
        continue;
      }

      let page = 1;
      let totalPages = 1;
      let syncedCount = 0;

      do {
        console.log(`[Turn14 Cron] Fetching page ${page}...`);
        const result = await fetchTurn14ItemsByBrand(brandId, page);
        totalPages = result.meta?.total_pages || 1;
        const items = result.data || [];

        for (const item of items) {
          const t14Id = String(item.id);
          const attrs = item.attributes || {};
          const hash = generateHash(item);

          // Find if we already have it
          const existingVariant = await prisma.shopProductVariant.findUnique({
            where: { turn14Id: t14Id },
            include: { product: true }
          });

          if (existingVariant) {
            // Check if it changed
            if (existingVariant.turn14Hash !== hash) {
              console.log(`[Turn14 Cron] Updating pricing for: ${t14Id}`);
              await prisma.shopProductVariant.update({
                where: { turn14Id: t14Id },
                data: {
                  priceUsd: attrs.dealer_price || attrs.jobber_price || 0,
                  turn14Hash: hash,
                  sku: attrs.internal_part_number || attrs.mfr_part_number || attrs.part_number || '',
                }
              });
            }
          } else {
             console.log(`[Turn14 Cron] Creating NEW product: ${t14Id}`);
             
             // Extract English name
             const titleEn = attrs.product_name || attrs.item_name || 'Turn14 Product';
             const brandStr = attrs.brand_short_description || attrs.brand || brandName;
             
             // Setup dimension/weight
             let weightKg = null;
             let lengthCm = null;
             let widthCm = null;
             let heightCm = null;

             if (attrs.dimensions && attrs.dimensions[0]) {
               const d = attrs.dimensions[0];
               if (d.weight) weightKg = d.weight * 0.453592; // lbs to kg
               if (d.length) lengthCm = d.length * 2.54; // inch to cm
               if (d.width) widthCm = d.width * 2.54;
               if (d.height) heightCm = d.height * 2.54;
             }

             // We must create a wrapper Product and then a Variant
             // We generate a safe slug
             const safeSlug = `t14-${t14Id}-${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

             const newProduct = await prisma.shopProduct.create({
               data: {
                 slug: safeSlug,
                 titleEn: titleEn,
                 titleUa: titleEn,
                 brand: brandStr,
                 isPublished: false,
                 vendor: 'Turn14'
               }
             });

             await prisma.shopProductVariant.create({
               data: {
                 productId: newProduct.id,
                 turn14Id: t14Id,
                 turn14Hash: hash,
                 title: 'Default',
                 sku: attrs.internal_part_number || attrs.mfr_part_number || attrs.part_number || '',
                 priceUsd: attrs.dealer_price || attrs.jobber_price || 0,
                 weight: weightKg,
                 length: lengthCm,
                 width: widthCm,
                 height: heightCm,
                 image: attrs.thumbnail || attrs.primary_image || '',
                 inventoryQty: attrs.regular_stock ? 10 : 0
               }
             });
          }
          syncedCount++;
        }
        
        page++;
        // Small delay to respect rate limit
        await new Promise(r => setTimeout(r, 800));
        
      } while (page <= totalPages);

      console.log(`[Turn14 Cron] Finished ${brandName}: Synced ${syncedCount} items.`);

    } catch (e) {
      console.error(`[Turn14 Cron] Error syncing brand ${brandName}:`, e);
    }
  }

  console.log(`[Turn14 Cron] Sync Complete.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
