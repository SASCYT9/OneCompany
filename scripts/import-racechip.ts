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
 * RaceChip GTS 5 Import Script
 *
 * Reads scraped products from data/racechip-products.json
 * and upserts all products + variants into the database.
 */

interface ScrapedProduct {
  url: string;
  makeSlug: string;
  modelSlug: string;
  engineSlug: string;
  title: string;
  selectedTier: string;
  hasAppControl: boolean;
  priceGTS5: number;
  priceAppControl: number;
  priceEUR: number;
  baseHp: number;
  baseKw: number;
  baseNm: number;
  ccm: number;
  gainHp: number;
  gainNm: number;
  images: string[];
  timestamp: string;
}

// ── Helpers ────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMake(slug: string): string {
  const special: Record<string, string> = {
    'bmw': 'BMW', 'vw': 'Volkswagen', 'mercedes-benz': 'Mercedes-Benz',
    'alfa-romeo': 'Alfa Romeo', 'land-rover': 'Land Rover',
    'ds': 'DS', 'mini': 'MINI', 'kia': 'Kia', 'ssangyong': 'SsangYong',
    'ldv': 'LDV', 'mclaren': 'McLaren',
  };
  if (special[slug]) return special[slug];
  return slug.split('-').map(capitalize).join(' ');
}

function formatModel(slug: string): string {
  // Remove "from-YYYY" or "YYYY-to-YYYY" year ranges
  const cleaned = slug
    .replace(/-?from-\d{4}/, '')
    .replace(/-?\d{4}-to-\d{4}/, '')
    .replace(/^-|-$/g, '');

  // Uppercase chassis codes like g30, w205, f10, x5, etc.
  return cleaned
    .split('-')
    .map(part => {
      if (/^[a-z]\d+$/i.test(part) || /^\d+$/.test(part) || part.length <= 3) {
        return part.toUpperCase();
      }
      return capitalize(part);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYears(modelSlug: string): string {
  const fromMatch = modelSlug.match(/from-(\d{4})/);
  const rangeMatch = modelSlug.match(/(\d{4})-to-(\d{4})/);
  if (rangeMatch) return `${rangeMatch[1]}–${rangeMatch[2]}`;
  if (fromMatch) return `${fromMatch[1]}+`;
  return '';
}

function formatEngine(slug: string): string {
  // "1-6-d-1598ccm-116hp-85kw-300nm" → "1.6 D 1598cc"
  return slug
    .replace(/(\d+)-(\d+)/, '$1.$2')    // 1-6 → 1.6
    .replace(/-/g, ' ')                   // remaining dashes → spaces
    .replace(/(\d+)ccm.*/, '$1cc')        // strip after ccm
    .toUpperCase()
    .trim();
}

function generateSlug(p: ScrapedProduct): string {
  return `racechip-gts5-${p.makeSlug}-${p.modelSlug}-${p.engineSlug}`
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

function generateSku(p: ScrapedProduct): string {
  return `RC-GTS5-${p.makeSlug}-${p.engineSlug}`
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function generateTitleEn(p: ScrapedProduct): string {
  const make = formatMake(p.makeSlug);
  const model = formatModel(p.modelSlug);
  const years = extractYears(p.modelSlug);
  const engine = formatEngine(p.engineSlug);
  const yearStr = years ? ` (${years})` : '';
  return `RaceChip GTS 5 — ${make} ${model}${yearStr} ${engine}`.trim();
}

function generateTitleUa(p: ScrapedProduct): string {
  const make = formatMake(p.makeSlug);
  const model = formatModel(p.modelSlug);
  const years = extractYears(p.modelSlug);
  const engine = formatEngine(p.engineSlug);
  const yearStr = years ? ` (${years})` : '';
  return `RaceChip GTS 5 — ${make} ${model}${yearStr} ${engine}`.trim();
}

function generateDescEn(p: ScrapedProduct): string {
  const make = formatMake(p.makeSlug);
  const model = formatModel(p.modelSlug);
  const totalHp = p.baseHp + p.gainHp;
  const totalNm = p.baseNm + p.gainNm;

  return `<div class="racechip-specs">
<h3>Performance Upgrade</h3>
<ul>
  <li><strong>Vehicle:</strong> ${make} ${model}</li>
  <li><strong>Engine:</strong> ${p.ccm}cc / ${p.baseHp} HP (${p.baseKw} kW) / ${p.baseNm} Nm</li>
  <li><strong>Power Gain:</strong> +${p.gainHp} HP / +${p.gainNm} Nm</li>
  <li><strong>Total After Tuning:</strong> ${totalHp} HP / ${totalNm} Nm</li>
  <li><strong>Module:</strong> RaceChip GTS 5 — Maximum Driving Dynamics</li>
  <li><strong>App Control:</strong> ✅ Included in price — full smartphone control via RaceChip App</li>
</ul>
<h3>What's Included</h3>
<ul>
  <li>RaceChip GTS 5 tuning module</li>
  <li>RaceChip App Control module (included, no extra cost)</li>
  <li>7 fine tuning mappings</li>
  <li>RaceChip safety package</li>
  <li>Lifetime software updates</li>
  <li>Up to 15% fuel savings</li>
</ul>
<p><em>Easy plug & play installation. No permanent modifications to your vehicle.</em></p>
</div>`;
}

function generateDescUa(p: ScrapedProduct): string {
  const make = formatMake(p.makeSlug);
  const model = formatModel(p.modelSlug);
  const totalHp = p.baseHp + p.gainHp;
  const totalNm = p.baseNm + p.gainNm;

  return `<div class="racechip-specs">
<h3>Збільшення потужності</h3>
<ul>
  <li><strong>Автомобіль:</strong> ${make} ${model}</li>
  <li><strong>Двигун:</strong> ${p.ccm}cc / ${p.baseHp} к.с. (${p.baseKw} кВт) / ${p.baseNm} Нм</li>
  <li><strong>Приріст:</strong> +${p.gainHp} к.с. / +${p.gainNm} Нм</li>
  <li><strong>Після тюнінгу:</strong> ${totalHp} к.с. / ${totalNm} Нм</li>
  <li><strong>Модуль:</strong> RaceChip GTS 5 — Максимальна динаміка</li>
  <li><strong>App Control:</strong> ✅ Вже включено в ціну — повне керування зі смартфону через RaceChip App</li>
</ul>
<h3>Що входить в комплект</h3>
<ul>
  <li>Тюнінг-модуль RaceChip GTS 5</li>
  <li>Модуль RaceChip App Control (включено, без додаткових витрат)</li>
  <li>7 точних налаштувань картографії</li>
  <li>Пакет безпеки RaceChip</li>
  <li>Довічні оновлення софту</li>
  <li>Економія палива до 15%</li>
</ul>
<p><em>Проста plug & play установка. Без постійних модифікацій автомобіля.</em></p>
</div>`;
}

function generateTags(p: ScrapedProduct): string[] {
  return [
    `car_make:${p.makeSlug}`,
    `car_model:${p.modelSlug}`,
    `car_engine:${p.engineSlug}`,
    'tier:gts5',
    'app_control',
    'chip_tuning',
    `ccm:${p.ccm}`,
    `base_hp:${p.baseHp}`,
    `gain_hp:${p.gainHp}`,
    `gain_nm:${p.gainNm}`,
  ];
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'racechip-products.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    console.error('Run the scraper first: node scripts/scrape-racechip.mjs');
    return;
  }

  const products: ScrapedProduct[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 Found ${products.length} RaceChip products to import...`);

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
  const startTime = Date.now();

  for (let i = 0; i < uniqueProducts.length; i++) {
    const p = uniqueProducts[i];
    try {
      const slug = generateSlug(p);
      const sku = generateSku(p);
      const priceStr = p.priceEUR > 0 ? p.priceEUR.toString() : null;
      const image = p.images?.find((img) => img.includes("gts-black-three-quarter")) || p.images?.find((img) => img.includes("pdp_images/product")) || p.images?.[0] || null;

      // Upsert the main product
      const shopProduct = await prisma.shopProduct.upsert({
        where: { slug },
        update: {
          titleEn: generateTitleEn(p),
          titleUa: generateTitleUa(p),
          priceEur: priceStr,
          longDescEn: generateDescEn(p),
          longDescUa: generateDescUa(p),
          bodyHtmlEn: generateDescEn(p),
          bodyHtmlUa: generateDescUa(p),
          tags: generateTags(p),
          image,
        },
        create: {
          slug,
          sku,
          scope: 'SHOP',
          brand: 'RaceChip',
          vendor: 'RaceChip',
          titleEn: generateTitleEn(p),
          titleUa: generateTitleUa(p),
          categoryEn: 'Chip Tuning',
          categoryUa: 'Чіп-тюнінг',
          shortDescEn: `+${p.gainHp} HP / +${p.gainNm} Nm — RaceChip GTS 5 with App Control`,
          shortDescUa: `+${p.gainHp} к.с. / +${p.gainNm} Нм — RaceChip GTS 5 з App Control`,
          priceEur: priceStr,
          isPublished: true,
          status: 'ACTIVE',
          stock: 'inStock',
          longDescEn: generateDescEn(p),
          longDescUa: generateDescUa(p),
          bodyHtmlEn: generateDescEn(p),
          bodyHtmlUa: generateDescUa(p),
          tags: generateTags(p),
          image,
        },
      });

      // Upsert the variant (GTS 5 + App Control)
      const variantSku = sku + '-AC';
      const existingVariant = await prisma.shopProductVariant.findFirst({
        where: { sku: variantSku, productId: shopProduct.id },
      });

      if (existingVariant) {
        await prisma.shopProductVariant.update({
          where: { id: existingVariant.id },
          data: { priceEur: priceStr, title: 'GTS 5 + App Control' },
        });
        updated++;
      } else {
        await prisma.shopProductVariant.create({
          data: {
            productId: shopProduct.id,
            sku: variantSku,
            title: 'GTS 5 + App Control',
            priceEur: priceStr,
            grams: 500,
            inventoryQty: 100,
            isDefault: true,
          },
        });
        created++;
      }

      if ((i + 1) % 200 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
        console.log(`⏳ ${i + 1}/${uniqueProducts.length} (${rate}/sec, ${elapsed}s elapsed)`);
      }
    } catch (err: any) {
      errors++;
      if (errors <= 10) console.error(`❌ Error on ${p.makeSlug}/${p.engineSlug}: ${err.message}`);
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ RaceChip Import Complete in ${totalSec}s!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors:  ${errors}`);
  console.log(`   Total:   ${uniqueProducts.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
