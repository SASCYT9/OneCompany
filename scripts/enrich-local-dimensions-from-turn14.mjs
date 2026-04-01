import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const prisma = new PrismaClient();

// ⚠️ SAFETY: Only update these 4 dimension columns. Nothing else is touched.
const MAX_UPDATES = 10;

async function run() {
  console.log('=== Enriching LOCAL variants with Turn14 Dimensions ===');
  console.log(`⚠️  SAFETY: Max ${MAX_UPDATES} updates. Only weight/length/width/height columns.\n`);

  // STEP 1: Get unique brands from Turn14 cache
  const t14Brands = await prisma.$queryRaw`SELECT DISTINCT brand FROM turn14_catalog_items`;
  const brandSet = new Set(t14Brands.map(b => b.brand.toLowerCase()));
  console.log(`📋 Turn14 has ${brandSet.size} unique brands in our local cache.`);

  // STEP 2: Get unique brands from our LOCAL shop products
  const localBrands = await prisma.shopProduct.findMany({
    select: { brand: true },
    distinct: ['brand'],
  });

  // STEP 3: Find overlap
  const matchingBrands = localBrands
    .filter(p => p.brand && brandSet.has(p.brand.toLowerCase()))
    .map(p => p.brand);

  console.log(`🔗 Matching brands (LOCAL ∩ Turn14): ${matchingBrands.length > 0 ? matchingBrands.join(', ') : 'NONE'}`);

  if (matchingBrands.length === 0) {
    console.log('\n⚠️  No overlapping brands found. Nothing to enrich.');
    console.log('   This means none of your LOCAL shop brands exist in the Turn14 catalog.');
    return;
  }

  // STEP 4: Get only LOCAL variants from matching brands that are missing dimensions
  const variants = await prisma.shopProductVariant.findMany({
    where: {
      product: {
        brand: { in: matchingBrands, mode: 'insensitive' }
      },
      OR: [
        { weight: null },
        { length: null },
        { width: null },
        { height: null },
      ]
    },
    select: {
      id: true,
      sku: true,
      title: true,
      weight: true,
      length: true,
      width: true,
      height: true,
      product: { select: { brand: true } },
    }
  });

  console.log(`🔎 Found ${variants.length} variants (from matching brands) missing dimensions.\n`);

  let updated = 0;

  for (const variant of variants) {
    if (updated >= MAX_UPDATES) {
      console.log(`\n🛑 Reached limit of ${MAX_UPDATES} updates. Stopping safely.`);
      break;
    }

    if (!variant.sku) continue;

    // Search Turn14 cache for this exact SKU
    const t14Item = await prisma.turn14CatalogItem.findFirst({
      where: {
        OR: [
          { partNumber: variant.sku },
          { mfrPartNumber: variant.sku }
        ]
      },
      select: {
        weight: true,
        rawAttributes: true,
        partNumber: true,
        brand: true,
      }
    });

    if (!t14Item) continue;

    const attrs = t14Item.rawAttributes || {};
    const dim = attrs.dimensions?.[0] || {};

    // Only fill in dimensions that are currently NULL — never overwrite existing data
    const updates = {};
    if (variant.weight === null && (t14Item.weight || dim.weight)) {
      updates.weight = Number(t14Item.weight || dim.weight);
    }
    if (variant.length === null && dim.length) {
      updates.length = Number(dim.length);
    }
    if (variant.width === null && dim.width) {
      updates.width = Number(dim.width);
    }
    if (variant.height === null && dim.height) {
      updates.height = Number(dim.height);
    }

    // Skip if there's nothing new to fill in
    if (Object.keys(updates).length === 0) continue;

    // Log BEFORE updating so we can audit
    console.log(`📦 [${updated + 1}/${MAX_UPDATES}] SKU: ${variant.sku} | Brand: ${variant.product?.brand}`);
    console.log(`   BEFORE → w:${variant.weight} l:${variant.length} w:${variant.width} h:${variant.height}`);
    console.log(`   AFTER  → ${JSON.stringify(updates)}`);

    await prisma.shopProductVariant.update({
      where: { id: variant.id },
      data: updates,
    });

    updated++;
  }

  console.log(`\n🎉 Done! Updated ${updated} variants (limit was ${MAX_UPDATES}).`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
