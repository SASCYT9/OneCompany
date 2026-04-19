import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { fetchTurn14ItemsByBrand } from '@/lib/turn14';

// This is meant to be called by a cron job or admin panel
export const maxDuration = 300; // 5 minutes max on Vercel Pro, or longer on local
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    // Optionally check for a secret token here if protecting the cron route
    // const authHeader = req.headers.get('authorization'); ...

    // 1. Get all active tracked brands
    const markups = await prisma.turn14BrandMarkup.findMany({
      where: { isActive: true },
    });

    if (!markups.length) {
      return NextResponse.json({ message: 'No active brands configured for sync.' });
    }

    let totalSaved = 0;
    
    // We will sync one brand at a time to avoid memory overload
    for (const markup of markups) {
      const brandId = markup.brandId;
      console.log(`[Turn14 Sync] Starting sync for brand: ${markup.brandName} (ID: ${brandId})`);

      await prisma.turn14BrandMarkup.update({
        where: { brandId },
        data: { syncStatus: 'syncing', syncProgress: 0, syncTotal: 0, syncMessage: 'Starting catalog scan...' }
      });

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const res = await fetchTurn14ItemsByBrand(brandId, page);
          const items = res.data || [];
          
          if (!items.length) {
            hasMore = false;
            break;
          }

          console.log(`[Turn14 Sync] Fetched page ${page} for brand ${markup.brandName} (${items.length} items)`);

          // Safety check against loop ignoring brand filters
          const validItems = items.filter((item: any) => {
             const itemBrandId = item.attributes?.brand_id?.toString();
             return !itemBrandId || itemBrandId === brandId;
          });

          // Process in chunks to avoid overwhelming the database connection pool
          const CHUNK_SIZE = 50;
          for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
            const chunk = validItems.slice(i, i + CHUNK_SIZE);
            const processPromises = chunk.map(async (item: any) => {
              const attrs = item.attributes || {};
              // Prepare fitment data
              const fitmentPayload: any[] = [];
              if (attrs.vehicle_make && attrs.vehicle_year && attrs.vehicle_model) {
                 fitmentPayload.push({
                   year: Array.isArray(attrs.vehicle_year) ? attrs.vehicle_year[0] : String(attrs.vehicle_year),
                   make: Array.isArray(attrs.vehicle_make) ? attrs.vehicle_make[0] : String(attrs.vehicle_make),
                   model: Array.isArray(attrs.vehicle_model) ? attrs.vehicle_model[0] : String(attrs.vehicle_model),
                   submodel: attrs.vehicle_submodel ? (Array.isArray(attrs.vehicle_submodel) ? attrs.vehicle_submodel[0] : String(attrs.vehicle_submodel)) : null,
                 });
              }

              const basePrice = parseFloat(attrs.retail_price || attrs.list_price || attrs.price || '0') || 0;
              const inStock = attrs.regular_stock > 0 || attrs.can_purchase === true;
              const category = attrs.category || null;
              const subcategory = attrs.subcategory || null;
              const partNumber = attrs.part_number || attrs.mfr_part_number || '';
              const name = attrs.product_name || attrs.item_name || attrs.name || 'Auto Part';
              const thumbnail = attrs.thumbnail || attrs.primary_image || null;

              await prisma.turn14Item.upsert({
                where: { id: item.id },
                update: {
                  partNumber, brand: markup.brandName, brandId, name, category, subcategory,
                  price: basePrice, inStock, thumbnail, attributes: attrs,
                },
                create: {
                  id: item.id, partNumber, brand: markup.brandName, brandId, name, category, subcategory,
                  price: basePrice, inStock, thumbnail, attributes: attrs,
                }
              });

              if (fitmentPayload.length > 0) {
                 await prisma.turn14Fitment.deleteMany({ where: { itemId: item.id } });
                 await prisma.turn14Fitment.createMany({
                   data: fitmentPayload.map(f => ({ ...f, itemId: item.id })), skipDuplicates: true
                 });
              }
            });
            await Promise.all(processPromises);
          }
          totalSaved += items.length;

          // Check if there are more pages
          const meta = res.meta || {};
          const totalPages = meta.total_pages || meta.last_page || 1;

          if (page % 5 === 0 || page === 1 || page === totalPages) {
            await prisma.turn14BrandMarkup.update({
              where: { brandId: markup.brandId },
              data: {
                syncStatus: 'syncing',
                syncProgress: page,
                syncTotal: totalPages,
                syncMessage: `Scanning page ${page}...`
              }
            });
          }

          if (page >= totalPages) {
            hasMore = false;
          } else {
            page++;
          }
        } catch (err: any) {
          console.error(`[Turn14 Sync] Error on brand ${markup.brandName} page ${page}:`, err.message);
          await prisma.turn14BrandMarkup.update({
            where: { brandId: markup.brandId },
            data: { syncStatus: 'error', syncMessage: `Failed on page ${page}: ${err.message}` }
          });
          return NextResponse.json({ success: false, error: err.message, step: `Brand ${markup.brandName} page ${page}` }, { status: 500 });
        }
      }

      // Finalize brand sync status
      await prisma.turn14BrandMarkup.update({
        where: { brandId: markup.brandId },
        data: {
          syncStatus: 'idle',
          syncMessage: `Scan complete.`,
          lastSyncAt: new Date()
        }
      });
    }

    return NextResponse.json({ success: true, message: `Synced ${totalSaved} items across ${markups.length} brands.` });
  } catch (error: any) {
    console.error('[Turn14 Sync] Global error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
