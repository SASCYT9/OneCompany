/**
 * DO88 Product Importer v2 — HTTP-based
 * 
 * Imports translated DO88 products by calling the temporary API endpoint
 * at /api/admin/shop/do88-import, which runs server-side with full Prisma access.
 * 
 * Usage: node scripts/import-do88-http.mjs
 * Prerequisites: Dev server must be running at localhost:3000
 */

import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'do88-products-translated.json');
const API_URL = 'http://localhost:3001/api/admin/temp-setup';
const BATCH_SIZE = 20;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Extract vehicle info from category ─────────────────────────────
function extractVehicleInfo(categoryOriginal) {
  if (!categoryOriginal?.includes('Modellanpassat')) return null;
  const parts = categoryOriginal.split(' > ').map(s => s.trim());
  const carBrand = parts[1] || '';
  const carModel = parts[2] || '';
  const carPlatform = parts[3] || '';
  if (!carBrand || carBrand === 'Clamp-kit' || carBrand === 'Luftfilter') return null;
  return { carBrand, carModel, carPlatform };
}

// ─── Generate tags ──────────────────────────────────────────────────
function generateTags(product) {
  const tags = ['DO88', 'Performance'];
  const catParts = (product.categoryEn || '').split(' > ');
  for (const part of catParts) {
    const clean = part.trim();
    if (clean && clean.length > 1) tags.push(clean);
  }
  const vehicle = extractVehicleInfo(product.categoryOriginal);
  if (vehicle) {
    tags.push(vehicle.carBrand);
    if (vehicle.carModel) {
      tags.push(vehicle.carModel);
      tags.push(`${vehicle.carBrand} ${vehicle.carModel}`);
    }
    if (vehicle.carPlatform) tags.push(vehicle.carPlatform);
  }
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
  return [...new Set(tags.filter(Boolean))];
}

// ─── Determine collection ───────────────────────────────────────────
function determineCollectionEn(product) {
  const titleLower = (product.titleEn || '').toLowerCase();
  const catLower = (product.categoryEn || '').toLowerCase();
  if (titleLower.includes('intercooler') || catLower.includes('intercooler')) return 'Intercoolers';
  if (titleLower.includes('radiator') || catLower.includes('radiator')) return 'Radiators';
  if (titleLower.includes('oil cooler') || catLower.includes('oil cooler')) return 'Oil Coolers';
  if (titleLower.includes('intake') || catLower.includes('intake')) return 'Intake Systems';
  if (titleLower.includes('silicone hose') || catLower.includes('silicone hose')) return 'Performance Hoses';
  if (titleLower.includes('exhaust') || catLower.includes('exhaust')) return 'Exhaust Parts';
  if (titleLower.includes('heat') || catLower.includes('heat')) return 'Heat Protection';
  if (titleLower.includes('aluminum pipe') || catLower.includes('aluminum')) return 'Aluminum Pipes';
  if (titleLower.includes('hose kit') || catLower.includes('hose kit')) return 'Hose Kits';
  return 'Performance Parts';
}

const COLLECTION_EN_TO_UA = {
  'Intercoolers': 'Інтеркулери',
  'Radiators': 'Радіатори',
  'Oil Coolers': 'Масляні радіатори',
  'Intake Systems': 'Впускні системи',
  'Performance Hoses': 'Силіконові патрубки',
  'Exhaust Parts': 'Вихлопні деталі',
  'Heat Protection': 'Теплозахист',
  'Aluminum Pipes': 'Алюмінієві труби',
  'Hose Kits': 'Комплекти патрубків',
  'Performance Parts': 'Деталі',
};

function generateSlug(sku) {
  return `do88-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

// ─── Convert product to admin payload format ────────────────────────
function toAdminPayload(p) {
  const slug = generateSlug(p.sku);
  const tags = generateTags(p);
  const collectionEn = determineCollectionEn(p);
  const collectionUa = COLLECTION_EN_TO_UA[collectionEn] || 'Деталі';
  const priceEur = p.priceEUR_final;

  return {
    slug,
    sku: p.sku,
    scope: 'auto',
    brand: 'DO88',
    vendor: 'DO88',
    productType: 'Performance Part',
    productCategory: p.categoryEn,
    status: 'ACTIVE',
    titleUa: p.titleUa || p.titleEn || p.title,
    titleEn: p.titleEn || p.title,
    categoryUa: p.categoryUa || null,
    categoryEn: p.categoryEn || null,
    shortDescUa: p.shortDescUa || null,
    shortDescEn: p.shortDescEn || null,
    bodyHtmlUa: p.bodyHtmlUa || null,
    bodyHtmlEn: p.bodyHtmlEn || null,
    leadTimeEn: 'Ships in 5-10 business days',
    leadTimeUa: 'Відправка за 5-10 робочих днів',
    stock: 'inStock',
    collectionUa,
    collectionEn,
    priceEur,
    image: p.imageUrl || null,
    isPublished: true,
    tags,
    collectionIds: [],
    media: p.imageUrl ? [{ src: p.imageUrl, altText: p.titleEn, position: 1, mediaType: 'IMAGE' }] : [],
    options: [],
    variants: [{
      title: 'Default Title',
      sku: p.sku,
      position: 1,
      inventoryQty: 0,
      inventoryPolicy: 'CONTINUE',
      priceEur,
      requiresShipping: true,
      taxable: true,
      image: p.imageUrl || null,
      isDefault: true,
    }],
    metafields: [],
  };
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('📦 DO88 Product Importer v2 (HTTP)');
  console.log('===================================\n');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`📋 Loaded ${products.length} translated products`);
  console.log(`🌐 API: ${API_URL}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}\n`);

  // Convert all products to admin payload format
  const payloads = products.map(toAdminPayload);

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Process in batches
  const batchCount = Math.ceil(payloads.length / BATCH_SIZE);
  
  for (let i = 0; i < batchCount; i++) {
    const batch = payloads.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const batchNum = i + 1;
    process.stdout.write(`  [Batch ${batchNum}/${batchCount}] ${batch.length} products...`);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: batch }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.log(` ❌ HTTP ${res.status}: ${text.substring(0, 100)}`);
        totalErrors += batch.length;
      } else {
        const result = await res.json();
        totalCreated += result.created || 0;
        totalUpdated += result.updated || 0;
        totalErrors += (result.errors || []).length;
        console.log(` ✅ created: ${result.created}, updated: ${result.updated}, errors: ${(result.errors || []).length}`);
        
        if (result.errors?.length > 0 && i < 3) {
          result.errors.forEach(e => console.log(`     ⚠️  ${e.slug}: ${e.error.substring(0, 80)}`));
        }
      }
    } catch (err) {
      console.log(` ❌ ${err.message}`);
      totalErrors += batch.length;
    }

    await sleep(200);
  }

  console.log(`\n📊 Import Complete:`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Errors:  ${totalErrors}`);
  console.log(`   Total:   ${payloads.length}`);
  console.log(`\n✨ Done! Check admin at /admin/shop/products`);
}

main();
