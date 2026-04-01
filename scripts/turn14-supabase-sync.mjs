import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env.local' });

// Configuration
const TURN14_CLIENT_ID = process.env.TURN14_CLIENT_ID || 'f7a47aba33fa6f87a218de26e824d32e499d58e9';
const TURN14_CLIENT_SECRET = process.env.TURN14_CLIENT_SECRET || 'efc5ff7645b09faa8c9b5c602a6c8fec2937f89f';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

// --- Turn14 Utilities ---
async function getTurn14AccessToken() {
  const response = await fetch(`https://api.turn14.com/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: TURN14_CLIENT_ID, client_secret: TURN14_CLIENT_SECRET }),
  });
  if (!response.ok) throw new Error('Failed to fetch Turn14 token');
  const data = await response.json();
  return data.access_token;
}

// --- Main Execution ---
async function run() {
  console.log('=== Turn14 ➡️ PostgreSQL (Supabase) Sync Engine ===');
  
  if (isDryRun) {
     console.log('⚠️ DRY RUN MODE. Data will NOT be pushed to PostgreSQL.');
  }

  // STEP 0: Only download brands that exist on our One Company website
  // Extract brand names from our brands.ts catalog
  const OUR_BRANDS = [
    // USA brands
    'Airlift Performance', 'AMS', 'Borla', 'Burger Motorsport', 'Burger Motorsports',
    'Cobb tuning', 'COBB', 'CSF', 'Deatschwerks', 'DeatschWerks', 'Dinan',
    'Fabspeed', 'Girodisc', 'GiroDisc', 'Injector Dynamics', 'Kooks Headers',
    'Lingenfelter', 'Mickey Thompson', 'Mountune', 'Renntech', 'Seibon Carbon', 'Seibon',
    'SPL Parts', 'Stoptech', 'StopTech', 'Stillen', 'Vorsteiner', 'Whipple Superchargers',
    // Europe brands
    'Akrapovic', 'Akrapovič', 'BC Racing', 'Brembo', 'do88', 'DO88',
    'Eventuri', 'KW Suspension', 'KW', 'Milltek', 'Mishimoto',
    'Remus', 'Wagner Tuning', 'Ohlins', 'Öhlins',
    // Racing brands  
    'Samsonas Motorsport',
  ];
  const includeBrands = new Set(OUR_BRANDS.map(b => b.toLowerCase()));
  console.log(`✅ INCLUDE filter: Only downloading ${includeBrands.size} brand names from Turn14`);
  console.log(`   Brands: ${OUR_BRANDS.join(', ')}\n`);

  const token = await getTurn14AccessToken();
  console.log('🔄 Connected to Turn14 API. Scanning Turn14 Wholesale Catalog...');
  
  let page = 1;
  let totalSaved = 0;
  let totalSkipped = 0;

  while(true) {
    const res = await fetch(`https://api.turn14.com/v1/items?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
        console.error("Turn14 API Error:", await res.text());
        break;
    }
    
    const body = await res.json();
    const items = body.data || [];
    if (items.length === 0) break;
    
    // Only keep items whose brand is on our One Company website
    const newItems = items.filter((item) => {
      const brand = (item.attributes?.brand || '').toLowerCase();
      if (!includeBrands.has(brand)) {
        totalSkipped++;
        return false;
      }
      return true;
    });

    const upsertBatch = newItems.map((item) => {
      const attrs = item.attributes || {};
      const tBrand = attrs.brand || '';
      
      const weight = attrs.weight || attrs.dimensions?.[0]?.weight || 0;
      
      return prisma.turn14CatalogItem.upsert({
        where: { partNumber: attrs.part_number || item.id },
        update: {
          mfrPartNumber: attrs.mfr_part_number || null,
          productName: attrs.item_name || attrs.product_name || `Turn14 Item ${item.id}`,
          brandId: attrs.brand_id || 0,
          brand: tBrand,
          category: attrs.category || null,
          subcategory: attrs.subcategory || null,
          weight: Number(weight) || 0,
          dealerPrice: null,
          retailPrice: null,
          rawAttributes: attrs,
        },
        create: {
          id: item.id,
          partNumber: attrs.part_number || item.id,
          mfrPartNumber: attrs.mfr_part_number || null,
          productName: attrs.item_name || attrs.product_name || `Turn14 Item ${item.id}`,
          brandId: attrs.brand_id || 0,
          brand: tBrand,
          category: attrs.category || null,
          subcategory: attrs.subcategory || null,
          weight: Number(weight) || 0,
          dealerPrice: null,
          retailPrice: null,
          rawAttributes: attrs,
        }
      });
    });

    if (!isDryRun && upsertBatch.length > 0) {
        // Run Prisma calls in chunks of 20 to prevent pool exhaustion
        for (let i = 0; i < upsertBatch.length; i += 20) {
            await Promise.all(upsertBatch.slice(i, i + 20));
        }
        totalSaved += upsertBatch.length;
    } else {
        if (page === 1) {
            console.log("Sample First Item:");
            console.log(JSON.stringify(items[0], null, 2));
        }
        totalSaved += items.length;
    }
    
    const totalPages = body.meta?.total_pages || '?';
    process.stdout.write(`\r  Page ${page}/${totalPages} | Saved: ${totalSaved} | Skipped (local brands): ${totalSkipped}`);
    
    if (page >= (body.meta?.total_pages || 1)) break;
    
    page++;
    
    // Safety delay to prevent Turn14 rate limiting
    await new Promise(r => setTimeout(r, 600));
  }
  
  console.log(`\n🎉 Finished! Processed ${totalSaved} items into local PostgreSQL.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
