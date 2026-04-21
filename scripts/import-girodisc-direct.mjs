#!/usr/bin/env node
/**
 * GiroDisc Missing Products — Direct DB Insert
 * Uses DIRECT_URL (port 5432) to avoid pooler timeout issues.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

// Force direct connection (non-pooling)
process.env.DATABASE_URL = process.env.DIRECT_URL;

const { PrismaClient } = await import('@prisma/client');
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
});

const DISCOUNT = 0.10;
const UAH_TO_EUR = 52;
const UAH_TO_USD = 45;

function calcPrices(priceUah) {
  if (!priceUah || priceUah <= 0) return { uah: null, eur: null, usd: null };
  const d = priceUah * (1 - DISCOUNT);
  return { uah: d.toFixed(2), eur: (d / UAH_TO_EUR).toFixed(2), usd: (d / UAH_TO_USD).toFixed(2) };
}

function generateSlug(p) {
  let slug = p.handle;
  if (!slug.startsWith('girodisc-')) slug = `girodisc-${slug}`;
  return slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 200);
}

function classifyCategory(cat) {
  const map = {
    rotors: { ua: 'Гальмівні диски', en: 'Brake Rotors' },
    pads: { ua: 'Гальмівні колодки', en: 'Brake Pads' },
    shields: { ua: 'Теплові щити', en: 'Heat Shields' },
    hardware: { ua: 'Кріплення', en: 'Hardware' },
  };
  return map[cat] || map.rotors;
}

const COLL = {
  main: 'col_girodisc_main', rotors: 'col_girodisc_rotors',
  pads: 'col_girodisc_pads', shields: 'col_girodisc_shields', hardware: 'col_girodisc_hardware',
};

async function main() {
  console.log('🔌 Connecting via DIRECT_URL (port 5432)...');
  
  // Test connection
  const testResult = await prisma.$queryRaw`SELECT 1 as ok`;
  console.log('✅ DB connected!\n');

  const jsonPath = path.join(process.cwd(), 'data', 'girodisc-products.json');
  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 ${products.length} products in JSON`);

  // Get existing slugs
  const existing = await prisma.shopProduct.findMany({
    where: { brand: 'GiroDisc' },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map(p => p.slug));
  console.log(`📁 ${existingSlugs.size} already in DB`);

  const missing = products.filter(p => !existingSlugs.has(generateSlug(p)));
  console.log(`🔍 ${missing.length} missing\n`);

  if (missing.length === 0) {
    console.log('✅ All done!');
    return;
  }

  let created = 0, errors = 0;

  for (let i = 0; i < missing.length; i++) {
    const p = missing[i];
    try {
      const slug = generateSlug(p);
      const prices = calcPrices(p.priceUah);
      const comparePrices = calcPrices(p.compareAtPriceUah);
      const cat = classifyCategory(p.category);

      const product = await prisma.shopProduct.create({
        data: {
          slug, sku: p.sku, scope: 'SHOP', brand: 'GiroDisc', vendor: 'GiroDisc',
          titleUa: p.title.trim(), titleEn: p.title.trim(),
          categoryUa: cat.ua, categoryEn: cat.en,
          shortDescUa: `GiroDisc ${p.sku || ''} — преміальний гальмівний компонент`,
          shortDescEn: `GiroDisc ${p.sku || ''} — premium brake component`,
          priceUah: prices.uah, priceEur: prices.eur, priceUsd: prices.usd,
          compareAtUah: comparePrices.uah, compareAtEur: comparePrices.eur, compareAtUsd: comparePrices.usd,
          isPublished: true, status: 'ACTIVE', stock: 'inStock',
          bodyHtmlUa: p.bodyHtml, bodyHtmlEn: p.bodyHtml,
          longDescUa: p.bodyHtml, longDescEn: p.bodyHtml,
          tags: ['brand:girodisc', `category:${p.category}`, p.sku ? `sku:${p.sku}` : null].filter(Boolean),
          image: p.image, supplier: 'atomic-shop.ua', originCountry: 'US',
        },
      });

      // Default variant
      await prisma.shopProductVariant.create({
        data: {
          productId: product.id, sku: p.sku, title: 'Default',
          priceUah: prices.uah, priceEur: prices.eur, priceUsd: prices.usd,
          compareAtUah: comparePrices.uah, compareAtEur: comparePrices.eur, compareAtUsd: comparePrices.usd,
          inventoryQty: 0, inventoryPolicy: 'CONTINUE', isDefault: true,
        },
      });

      // Collection links
      await prisma.shopProductCollection.createMany({
        data: [
          { productId: product.id, collectionId: COLL.main },
          ...(COLL[p.category] ? [{ productId: product.id, collectionId: COLL[p.category] }] : []),
        ],
        skipDuplicates: true,
      });

      // Gallery
      if (p.gallery?.length > 0) {
        await prisma.shopProductMedia.createMany({
          data: p.gallery.map((src, idx) => ({
            productId: product.id, mediaType: 'IMAGE', src,
            altText: `${p.title} - ${idx + 1}`, position: idx + 1,
          })),
        });
      }

      created++;
      if (created % 10 === 0 || i === missing.length - 1) {
        console.log(`  ⏳ ${created}/${missing.length} (${i + 1} processed)`);
      }
    } catch (err) {
      errors++;
      if (errors <= 10) console.error(`  ❌ ${p.sku || p.handle}: ${err.message.substring(0, 80)}`);
    }
  }

  console.log(`\n🏁 Done! Created: ${created}, Errors: ${errors}`);
  
  // Final count
  const total = await prisma.shopProduct.count({ where: { brand: 'GiroDisc' } });
  console.log(`📊 Total GiroDisc in DB: ${total}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
