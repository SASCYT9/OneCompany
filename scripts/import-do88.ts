/**
 * DO88 Product Importer
 * 
 * Imports all translated DO88 products into the local ShopProduct database
 * via direct Prisma calls, matching the existing admin schema.
 * 
 * - Sets brand = 'DO88'
 * - Sets titleEn / titleUa from translations
 * - Sets priceEur from the calculated EUR price  
 * - Adds tags for vehicle filter matching (car brand, model, category)
 * - Creates ShopProductVariant with EUR pricing
 * - Links to DO88 images
 * 
 * Usage: npx tsx scripts/import-do88.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const INPUT_FILE = path.join(process.cwd(), 'do88-products-translated.json');

// ─── Extract vehicle info from category ─────────────────────────────
function extractVehicleInfo(categoryOriginal: string): { carBrand: string; carModel: string; carPlatform: string } | null {
  if (!categoryOriginal.includes('Modellanpassat')) return null;
  
  const parts = categoryOriginal.split(' > ').map(s => s.trim());
  // Modellanpassat > BMW > E90, S65 (M3)
  // Modellanpassat > Porsche > 991.1, Turbo (911)
  
  const carBrand = parts[1] || '';
  const carModel = parts[2] || '';
  const carPlatform = parts[3] || '';
  
  if (!carBrand || carBrand === 'Clamp-kit' || carBrand === 'Luftfilter') return null;
  
  return { carBrand, carModel, carPlatform };
}

// ─── Generate tags for product ──────────────────────────────────────
function generateTags(product: any): string[] {
  const tags: string[] = ['DO88', 'Performance'];
  
  // Add category-based tags
  const catParts = (product.categoryEn || '').split(' > ');
  for (const part of catParts) {
    const clean = part.trim();
    if (clean && clean.length > 1) tags.push(clean);
  }
  
  // Add vehicle-specific tags
  const vehicle = extractVehicleInfo(product.categoryOriginal);
  if (vehicle) {
    tags.push(vehicle.carBrand);
    if (vehicle.carModel) {
      tags.push(vehicle.carModel);
      tags.push(`${vehicle.carBrand} ${vehicle.carModel}`);
    }
    if (vehicle.carPlatform) {
      tags.push(vehicle.carPlatform);
    }
  }
  
  // Add product type tags from English title
  const titleLower = (product.titleEn || '').toLowerCase();
  if (titleLower.includes('intercooler')) tags.push('Intercooler');
  if (titleLower.includes('radiator')) tags.push('Radiator');
  if (titleLower.includes('oil cooler')) tags.push('Oil Cooler');
  if (titleLower.includes('hose') || titleLower.includes('silicone')) tags.push('Silicone Hose');
  if (titleLower.includes('intake')) tags.push('Intake');
  if (titleLower.includes('exhaust')) tags.push('Exhaust');
  if (titleLower.includes('turbo')) tags.push('Turbo');
  if (titleLower.includes('filter')) tags.push('Air Filter');
  if (titleLower.includes('heat shield') || titleLower.includes('heat insul')) tags.push('Heat Shield');
  
  // Deduplicate
  return [...new Set(tags.filter(Boolean))];
}

// ─── Determine product collection ───────────────────────────────────
function determineCollectionEn(product: any): string {
  const titleLower = (product.titleEn || '').toLowerCase();
  const catLower = (product.categoryEn || '').toLowerCase();
  
  if (titleLower.includes('intercooler') || catLower.includes('intercooler')) return 'Intercoolers';
  if (titleLower.includes('radiator') || catLower.includes('radiator')) return 'Radiators';
  if (titleLower.includes('oil cooler') || catLower.includes('oil cooler')) return 'Oil Coolers';
  if (titleLower.includes('intake') || catLower.includes('intake')) return 'Intake Systems';
  if (titleLower.includes('silicone hose') || catLower.includes('silicone hose')) return 'Performance Hoses';
  if (titleLower.includes('exhaust') || catLower.includes('exhaust')) return 'Exhaust Parts';
  if (titleLower.includes('heat shield') || catLower.includes('heat')) return 'Heat Protection';
  if (titleLower.includes('aluminum pipe') || catLower.includes('aluminum')) return 'Aluminum Pipes';
  if (titleLower.includes('hose kit') || catLower.includes('hose kit')) return 'Hose Kits';
  if (catLower.includes('vehicle specific') || catLower.includes('för avto')) return 'Vehicle Specific';
  
  return 'Performance Parts';
}

function determineCollectionUa(product: any): string {
  const en = determineCollectionEn(product);
  const map: Record<string, string> = {
    'Intercoolers': 'Інтеркулери',
    'Radiators': 'Радіатори',
    'Oil Coolers': 'Масляні радіатори',
    'Intake Systems': 'Впускні системи',
    'Performance Hoses': 'Силіконові патрубки',
    'Exhaust Parts': 'Вихлопні деталі',
    'Heat Protection': 'Теплозахист',
    'Aluminum Pipes': 'Алюмінієві труби',
    'Hose Kits': 'Комплекти патрубків',
    'Vehicle Specific': 'Для автомобілів',
    'Performance Parts': 'Деталі',
  };
  return map[en] || 'Деталі';
}

// ─── Generate slug from SKU ─────────────────────────────────────────
function generateSlug(sku: string): string {
  return `do88-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

// ─── Main import ────────────────────────────────────────────────────
async function main() {
  console.log('📦 DO88 Product Importer');
  console.log('========================\n');
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.error('   Run translate-do88.mjs first.');
    process.exit(1);
  }
  
  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`📋 Loaded ${products.length} translated products\n`);
  
  // Pre-check: test DB connectivity
  try {
    const count = await prisma.shopProduct.count();
    console.log(`🔗 DB connected. Existing products: ${count}\n`);
  } catch (dbErr: any) {
    console.error('❌ Database connection failed:', dbErr.message?.substring(0, 500));
    process.exit(1);
  }
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const slug = generateSlug(p.sku);
    const tags = generateTags(p);
    const collectionEn = determineCollectionEn(p);
    const collectionUa = determineCollectionUa(p);
    const priceEur = p.priceEUR_final;
    
    process.stdout.write(`  [${i + 1}/${products.length}] ${slug}...`);
    
    try {
      const existing = await prisma.shopProduct.findUnique({ where: { slug } });
      
      const data = {
        slug,
        sku: p.sku,
        scope: 'auto',
        brand: 'DO88',
        vendor: 'DO88',
        productType: 'Performance Part',
        productCategory: p.categoryEn,
        status: 'ACTIVE' as const,
        titleUa: p.titleUa || p.titleEn || p.title,
        titleEn: p.titleEn || p.title,
        categoryUa: p.categoryUa || null,
        categoryEn: p.categoryEn || null,
        shortDescUa: p.shortDescUa || null,
        shortDescEn: p.shortDescEn || null,
        bodyHtmlUa: p.bodyHtmlUa || null,
        bodyHtmlEn: p.bodyHtmlEn || null,
        stock: 'inStock',
        collectionUa: collectionUa,
        collectionEn: collectionEn,
        priceEur: priceEur,
        image: p.imageUrl || null,
        isPublished: true,
        tags,
      };
      
      if (existing) {
        await prisma.shopProduct.update({
          where: { slug },
          data: {
            ...data,
            variants: {
              deleteMany: {},
              create: [{
                title: 'Default Title',
                sku: p.sku,
                position: 1,
                inventoryQty: 0,
                inventoryPolicy: 'CONTINUE',
                priceEur: priceEur,
                requiresShipping: true,
                taxable: true,
                image: p.imageUrl || null,
                isDefault: true,
              }],
            },
          },
        });
        updated++;
        console.log(` ♻️ updated`);
      } else {
        await prisma.shopProduct.create({
          data: {
            ...data,
            variants: {
              create: [{
                title: 'Default Title',
                sku: p.sku,
                position: 1,
                inventoryQty: 0,
                inventoryPolicy: 'CONTINUE',
                priceEur: priceEur,
                requiresShipping: true,
                taxable: true,
                image: p.imageUrl || null,
                isDefault: true,
              }],
            },
            media: p.imageUrl ? {
              create: [{
                src: p.imageUrl,
                altText: p.titleEn,
                position: 1,
                mediaType: 'IMAGE',
              }],
            } : undefined,
          },
        });
        created++;
        console.log(` ✅ created`);
      }
    } catch (err: any) {
      errors++;
      console.log(` ❌ ${err.message?.substring(0, 300)}`);
      if (errors < 3) console.log('   Full error:', JSON.stringify(err).substring(0, 500));
    }
  }
  
  console.log(`\n📊 Import Results:`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log(`   Total:   ${products.length}`);
  
  await prisma.$disconnect();
  console.log('\n✨ Import complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
