import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env' });
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

/**
 * GiroDisc Import Script
 *
 * Reads scraped products from data/girodisc-products.json
 * and upserts all products into the database, linking them
 * to the GiroDisc collections.
 *
 * Collections (pre-created in DB):
 *   col_girodisc_main     — All GiroDisc products
 *   col_girodisc_rotors   — Brake Rotors & Replacement Rings
 *   col_girodisc_pads     — Brake Pads (GP10/GP20/GP30/GP35)
 *   col_girodisc_shields  — Heat Shields
 *   col_girodisc_hardware — Hardware & Accessories
 */

// ── Types ──────────────────────────────────────────────────
interface ScrapedProduct {
  sourceId: string;
  handle: string;
  title: string;
  bodyHtml: string;
  productType: string;
  vendor: string;
  tags: string[];
  sku: string | null;
  priceUah: number | null;
  compareAtPriceUah: number | null;
  image: string | null;
  gallery: string[];
  available: boolean;
  category: 'rotors' | 'pads' | 'shields' | 'hardware';
  publishedAt: string;
  createdAt: string;
  scrapedAt: string;
}

// ── Pricing ───────────────────────────────────────────────
const DISCOUNT = 0.10;        // 10% off atomic-shop.ua price
const UAH_TO_EUR = 52;        // 1 EUR = 52 UAH
const UAH_TO_USD = 45;        // 1 USD = 45 UAH

function calculatePrices(priceUah: number | null) {
  if (!priceUah || priceUah <= 0) return { uah: null, eur: null, usd: null };
  const discountedUah = priceUah * (1 - DISCOUNT);  // -10%
  return {
    uah: discountedUah.toFixed(2),
    eur: (discountedUah / UAH_TO_EUR).toFixed(2),
    usd: (discountedUah / UAH_TO_USD).toFixed(2),
  };
}

// ── Collection IDs ────────────────────────────────────────
const COLLECTION_MAP: Record<string, string> = {
  main: 'col_girodisc_main',
  rotors: 'col_girodisc_rotors',
  pads: 'col_girodisc_pads',
  shields: 'col_girodisc_shields',
  hardware: 'col_girodisc_hardware',
};

// ── Helpers ────────────────────────────────────────────────
function generateSlug(p: ScrapedProduct): string {
  // Use the Shopify handle, prefixed with girodisc- if not already
  let slug = p.handle;
  if (!slug.startsWith('girodisc-')) {
    slug = `girodisc-${slug}`;
  }
  return slug
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

function cleanTitle(title: string): string {
  // Remove leading "GIRODISC " prefix for cleaner display, then re-add as brand
  return title.trim();
}

function generateTitleEn(p: ScrapedProduct): string {
  const title = cleanTitle(p.title);
  // If title is already in Ukrainian, create English version
  // Basic transliteration for common words
  return title
    .replace(/Комплект передніх гальмівних дисків/gi, 'Front Brake Rotor Kit')
    .replace(/Комплект задніх гальмівних дисків/gi, 'Rear Brake Rotor Kit')
    .replace(/Комплект змінних кілець переднього гальмівного диска/gi, 'Front Replacement Ring Kit')
    .replace(/Комплект змінних кілець заднього гальмівного диска/gi, 'Rear Replacement Ring Kit')
    .replace(/Комплект змінних кілець гальмівного диска/gi, 'Replacement Ring Kit')
    .replace(/Комплект сменных колец переднего тормозного диска/gi, 'Front Replacement Ring Kit')
    .replace(/Передні гальмівні колодки/gi, 'Front Brake Pads')
    .replace(/Задні гальмівні колодки/gi, 'Rear Brake Pads')
    .replace(/Гальмівні колодки/gi, 'Brake Pads')
    .replace(/для /gi, 'for ')
    .replace(/мм/g, 'mm');
}

function generateCategoryLabels(category: string): { categoryUa: string; categoryEn: string } {
  switch (category) {
    case 'rotors':
      return { categoryUa: 'Гальмівні диски', categoryEn: 'Brake Rotors' };
    case 'pads':
      return { categoryUa: 'Гальмівні колодки', categoryEn: 'Brake Pads' };
    case 'shields':
      return { categoryUa: 'Теплові щити', categoryEn: 'Heat Shields' };
    case 'hardware':
      return { categoryUa: 'Кріплення', categoryEn: 'Hardware' };
    default:
      return { categoryUa: 'Гальмівні компоненти', categoryEn: 'Brake Components' };
  }
}

function generateShortDescUa(p: ScrapedProduct): string {
  const sku = p.sku || '';
  if (p.category === 'pads') {
    return `Гоночні гальмівні колодки GiroDisc ${sku} — преміальний фрикційний склад для треку`;
  }
  if (p.category === 'shields') {
    return `Тепловий щит GiroDisc ${sku} — захист від перегріву гальмівної системи`;
  }
  return `Двокомпонентний гальмівний диск GiroDisc ${sku} — пряма заміна штатного ротора`;
}

function generateShortDescEn(p: ScrapedProduct): string {
  const sku = p.sku || '';
  if (p.category === 'pads') {
    return `GiroDisc ${sku} Racing Brake Pads — premium friction compound for track use`;
  }
  if (p.category === 'shields') {
    return `GiroDisc ${sku} Heat Shield — thermal protection for braking system`;
  }
  return `GiroDisc ${sku} 2-Piece Brake Rotor — direct replacement for OEM rotor`;
}

function generateTags(p: ScrapedProduct): string[] {
  const tags: string[] = [
    'brand:girodisc',
    `category:${p.category}`,
  ];


  if (p.sku) {
    tags.push(`sku:${p.sku}`);
    // Extract series from SKU
    const series = p.sku.match(/^([A-Z]+\d*)/)?.[1];
    if (series) tags.push(`series:${series}`);
  }

  // Extract car make from title
  const makePatterns = [
    'BMW', 'PORSCHE', 'FERRARI', 'LAMBORGHINI', 'AUDI', 'MERCEDES',
    'CHEVROLET', 'DODGE', 'FORD', 'HONDA', 'NISSAN', 'TOYOTA',
    'LOTUS', 'MCLAREN', 'MASERATI', 'ALFA ROMEO', 'SUBARU',
    'VOLKSWAGEN', 'MITSUBISHI', 'LEXUS', 'CORVETTE',
  ];

  for (const make of makePatterns) {
    if (p.title.toUpperCase().includes(make)) {
      tags.push(`car_make:${make.toLowerCase().replace(/\s+/g, '_')}`);
      break;
    }
  }

  // Source tags
  for (const tag of p.tags) {
    if (tag.startsWith('__label')) continue; // Skip Shopify internal labels
    tags.push(`source:${tag}`);
  }

  return tags;
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'girodisc-products.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    console.error('Run the scraper first: node scripts/scrape-girodisc.mjs');
    return;
  }

  const products: ScrapedProduct[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 Found ${products.length} GiroDisc products to import...`);

  // Verify collections exist (lookup by ID prefix)
  const collections = await prisma.shopCollection.findMany({
    where: { id: { startsWith: 'col_girodisc_' } },
  });
  console.log(`📁 Found ${collections.length} GiroDisc collections in DB`);

  if (collections.length === 0) {
    console.error('❌ No GiroDisc collections found! Create them first.');
    return;
  }

  const collectionIds = new Map(collections.map((c) => [c.id, c.id]));

  // Deduplicate by slug
  const slugMap = new Map<string, ScrapedProduct>();
  for (const p of products) {
    const slug = generateSlug(p);
    if (!slugMap.has(slug)) {
      slugMap.set(slug, p);
    }
  }
  const uniqueProducts = Array.from(slugMap.values());
  console.log(`🔍 ${uniqueProducts.length} unique products after deduplication\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;
  let linked = 0;
  const startTime = Date.now();

  for (let i = 0; i < uniqueProducts.length; i++) {
    const p = uniqueProducts[i];
    try {
      const slug = generateSlug(p);
      const { categoryUa, categoryEn } = generateCategoryLabels(p.category);
      const prices = calculatePrices(p.priceUah);
      const comparePrices = calculatePrices(p.compareAtPriceUah);

      // Upsert the main product
      const existing = await prisma.shopProduct.findUnique({ where: { slug } });

      const shopProduct = await prisma.shopProduct.upsert({
        where: { slug },
        update: {
          titleUa: cleanTitle(p.title),
          titleEn: generateTitleEn(p),
          priceUah: prices.uah,
          priceEur: prices.eur,
          priceUsd: prices.usd,
          compareAtUah: comparePrices.uah,
          compareAtEur: comparePrices.eur,
          compareAtUsd: comparePrices.usd,
          bodyHtmlUa: p.bodyHtml || undefined,
          longDescUa: p.bodyHtml || undefined,
          tags: generateTags(p),
          image: p.image,
        },
        create: {
          slug,
          sku: p.sku,
          scope: 'SHOP',
          brand: 'GiroDisc',
          vendor: 'GiroDisc',
          titleUa: cleanTitle(p.title),
          titleEn: generateTitleEn(p),
          categoryUa,
          categoryEn,
          shortDescUa: generateShortDescUa(p),
          shortDescEn: generateShortDescEn(p),
          priceUah: prices.uah,
          priceEur: prices.eur,
          priceUsd: prices.usd,
          compareAtUah: comparePrices.uah,
          compareAtEur: comparePrices.eur,
          compareAtUsd: comparePrices.usd,
          isPublished: true,
          status: 'ACTIVE',
          stock: 'inStock',
          longDescUa: p.bodyHtml,
          longDescEn: p.bodyHtml, // Ukrainian HTML for now, SEO can handle EN later
          bodyHtmlUa: p.bodyHtml,
          bodyHtmlEn: p.bodyHtml,
          tags: generateTags(p),
          image: p.image,
          supplier: 'atomic-shop.ua',
          originCountry: 'US',
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }

      // Create default variant if it doesn't exist
      const existingVariant = await prisma.shopProductVariant.findFirst({
        where: { productId: shopProduct.id, position: 1 },
      });

      if (!existingVariant) {
        await prisma.shopProductVariant.create({
          data: {
            productId: shopProduct.id,
            sku: p.sku,
            title: 'Default',
            priceUah: prices.uah,
            priceEur: prices.eur,
            priceUsd: prices.usd,
            compareAtUah: comparePrices.uah,
            compareAtEur: comparePrices.eur,
            compareAtUsd: comparePrices.usd,
            inventoryQty: 0,
            inventoryPolicy: 'CONTINUE',
            isDefault: true,
          },
        });
      } else {
        await prisma.shopProductVariant.update({
          where: { id: existingVariant.id },
          data: {
            priceUah: prices.uah,
            priceEur: prices.eur,
            priceUsd: prices.usd,
            compareAtUah: comparePrices.uah,
            compareAtEur: comparePrices.eur,
            compareAtUsd: comparePrices.usd,
          },
        });
      }

      // Link to collections
      // 1. Always link to main collection
      const mainCollectionId = collectionIds.get(COLLECTION_MAP.main);
      if (mainCollectionId) {
        await prisma.shopProductCollection.upsert({
          where: {
            productId_collectionId: {
              productId: shopProduct.id,
              collectionId: mainCollectionId,
            },
          },
          update: {},
          create: {
            productId: shopProduct.id,
            collectionId: mainCollectionId,
          },
        });
        linked++;
      }

      // 2. Link to category collection
      const categoryCollectionId = collectionIds.get(COLLECTION_MAP[p.category]);
      if (categoryCollectionId) {
        await prisma.shopProductCollection.upsert({
          where: {
            productId_collectionId: {
              productId: shopProduct.id,
              collectionId: categoryCollectionId,
            },
          },
          update: {},
          create: {
            productId: shopProduct.id,
            collectionId: categoryCollectionId,
          },
        });
        linked++;
      }

      // Add gallery images as ShopProductMedia
      if (p.gallery.length > 0) {
        // Only add if no media exists yet
        const existingMedia = await prisma.shopProductMedia.count({
          where: { productId: shopProduct.id },
        });

        if (existingMedia === 0) {
          for (let imgIdx = 0; imgIdx < p.gallery.length; imgIdx++) {
            await prisma.shopProductMedia.create({
              data: {
                productId: shopProduct.id,
                mediaType: 'IMAGE',
                src: p.gallery[imgIdx],
                altText: `${p.title} - Image ${imgIdx + 1}`,
                position: imgIdx + 1,
              },
            });
          }
        }
      }

      // Progress logging
      if ((i + 1) % 50 === 0 || i === uniqueProducts.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
        console.log(`⏳ ${i + 1}/${uniqueProducts.length} (${rate}/sec, ${elapsed}s elapsed)`);
      }
    } catch (err: any) {
      errors++;
      if (errors <= 20) {
        console.error(`❌ Error on "${p.sku || p.handle}": ${err.message}`);
      }
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ GiroDisc Import Complete in ${totalSec}s!`);
  console.log(`   Created:     ${created}`);
  console.log(`   Updated:     ${updated}`);
  console.log(`   Errors:      ${errors}`);
  console.log(`   Total:       ${uniqueProducts.length}`);
  console.log(`   Links:       ${linked} product-collection links`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
