/**
 * BRABUS Product Import Script
 * 
 * Reads brabus-products-raw.json, translates DE content → UA/EN,
 * deletes old Brabus products, creates new products + collections + media.
 * 
 * Usage:
 *   node scripts/brabus-import.mjs [--dry-run] [--delete-old] [--limit=50]
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// ─── Category Translations ──────────────────────────────────────────
const CATEGORY_MAP = {
  // German → { ua, en, handle }
  'Aerodynamik': { ua: 'Аеродинаміка', en: 'Aerodynamics', handle: 'aerodynamics' },
  'Design & Exterieur': { ua: 'Дизайн та Екстер\'єр', en: 'Design & Exterior', handle: 'design-exterior' },
  'Sonderzubehör': { ua: 'Спеціальні аксесуари', en: 'Special Accessories', handle: 'accessories' },
  'Adventure Upgrades': { ua: 'Пригодницький пакет', en: 'Adventure Package', handle: 'adventure' },
  'Leistungssteigerungen': { ua: 'Підвищення потужності', en: 'Performance Upgrades', handle: 'performance' },
  'Power & Sound': { ua: 'Потужність та звук', en: 'Power & Sound', handle: 'power-sound' },
  'Start-Stop Module': { ua: 'Модуль Start-Stop', en: 'Start-Stop Module', handle: 'start-stop' },
  'Fahrwerksmodule': { ua: 'Модулі підвіски', en: 'Suspension Modules', handle: 'suspension' },
  'Räder': { ua: 'Диски', en: 'Wheels', handle: 'wheels' },
  'Räder & Fahrwerk': { ua: 'Диски та Підвіска', en: 'Wheels & Suspension', handle: 'wheels-suspension' },
  'Räder Zubehör': { ua: 'Аксесуари для дисків', en: 'Wheel Accessories', handle: 'wheel-accessories' },
  'Interieur': { ua: 'Інтер\'єр', en: 'Interior', handle: 'interior' },
  'Abgasanlagen': { ua: 'Вихлопні системи', en: 'Exhaust Systems', handle: 'exhaust' },
};

// ─── Product Name Translations ──────────────────────────────────────
const TERM_MAP_DE_EN = {
  // Body & Exterior
  'Dachaufsatz': 'Roof Attachment',
  'Motorhaubenaufsatz': 'Hood Scoop',
  'Frontschürzenaufsatz': 'Front Bumper Attachment',
  'Frontschürzeneinsätze': 'Front Bumper Inserts',
  'Frontschürzeneinsatz': 'Front Bumper Insert',
  'Frontspoilerecken': 'Front Spoiler Corners',
  'Frontspoiler-Aufsätze': 'Front Spoiler Attachments',
  'Frontspoiler': 'Front Spoiler',
  'Frontaufsätze': 'Front Attachments',
  'Frontschürzen-Aufsätze': 'Front Bumper Attachments',
  'Frontschürze': 'Front Bumper',
  'Heckspoiler': 'Rear Spoiler',
  'Heckdiffusor': 'Rear Diffuser',
  'Heckschürzenaufsatz': 'Rear Bumper Attachment',
  'Heckschürzeneinsatz': 'Rear Bumper Insert',
  'Hecktüraufsatz': 'Tailgate Attachment',
  'Heckleuchten': 'Rear Lights',
  'Unterfahrschutz': 'Skid Plate',
  'Spiegelkappen': 'Mirror Caps',
  'Seitenleisten': 'Side Skirts',
  'Seitenschwelleraufsätze': 'Side Skirt Attachments',
  'Kotflügelaufsätze': 'Fender Extensions',
  'Radhausverbreiterungen': 'Fender Flares',
  'Kühlergrill': 'Radiator Grille',
  'Türgriffe': 'Door Handles',
  'Reserverad-Abdeckung': 'Spare Wheel Cover',
  'Kennzeichenhalter': 'License Plate Holder',
  'Dachgepäckträger': 'Roof Rack',
  'Heckleiter': 'Rear Ladder',
  'Windabweiser': 'Wind Deflector',
  'Endrohrblenden': 'Exhaust Tips',
  'Endrohr-Blenden': 'Exhaust Tip Covers',
  'Auspuffblenden': 'Exhaust Covers',
  // Power & Sound
  'Sportauspuff': 'Sport Exhaust',
  'Klappen-Sportauspuffanlage': 'Sport Valve Exhaust System',
  'Sportfedern': 'Sport Springs',
  'Tieferlegungsmodul': 'Lowering Module',
  'Leistungskit': 'Performance Kit',
  // Interior
  'Pedalauflagen': 'Pedal Covers',
  'Schaltwippen': 'Paddle Shifters',
  'Einstiegsleisten': 'Door Sills',
  'Fußbodenschoner': 'Floor Mats',
  'Fußstütze': 'Footrest',
  'Sonnenblenden': 'Sun Visors',
  'Dachkonsole': 'Roof Console',
  'Kofferraummatte': 'Trunk Mat',
  'Trennwand': 'Partition Wall',
  'Leder': 'Leather',
  'Vollleder-Komplettausstattung': 'Full Leather Interior',
  'Innenausstattung': 'Interior Package',
  // Wheels
  'Ventilkappen': 'Valve Caps',
  'Nabenkappe': 'Hub Cap',
  'Nabenkappen': 'Hub Caps',
  // Materials & finishes
  'Carbon': 'Carbon',
  'Aluminium': 'Aluminum',
  'Velours': 'Velour',
  'Velour': 'Velour',
  'glänzend': 'Glossy',
  'matt': 'Matte',
  'Sicht-Carbon': 'Exposed Carbon',
  'Höhenverstellbar': 'Height Adjustable',
  'feststehend': 'Fixed',
  'Aufsatz': 'Attachment',
  'Einsätze': 'Inserts',
  'Einsätzen': 'Inserts',
  // Special
  'Sonderschutzpanzerung': 'Armored Protection',
  'Fahrwerk': 'Suspension',
  'mit LED Scheinwerfern': 'with LED Headlights',
  'mit LED Tagfahrlicht': 'with LED DRL',
  'mit LED': 'with LED',
  'BRABUS Car Cover': 'BRABUS Car Cover',
  'Easy entry': 'Easy Entry',
  'Light Carpet': 'Light Carpet',
  'Masterpiece Interieur': 'Masterpiece Interior',
  'Interieur Accessoires Package': 'Interior Accessories Package',
  'Carbonpaket Innenraum': 'Carbon Interior Package',
  'Package Body & Sound': 'Body & Sound Package',
  'Türfangbänder': 'Door Check Straps',
  'Start-Stop Memory': 'Start-Stop Memory',
};

const TERM_MAP_DE_UA = {
  // Body & Exterior
  'Dachaufsatz': 'Даховий елемент',
  'Motorhaubenaufsatz': 'Накладка на капот',
  'Frontschürzenaufsatz': 'Накладка на передній бампер',
  'Frontschürzeneinsätze': 'Вставки переднього бампера',
  'Frontschürzeneinsatz': 'Вставка переднього бампера',
  'Frontspoilerecken': 'Кути переднього спойлера',
  'Frontspoiler-Aufsätze': 'Накладки переднього спойлера',
  'Frontspoiler': 'Передній спойлер',
  'Frontaufsätze': 'Передні накладки',
  'Frontschürzen-Aufsätze': 'Накладки переднього бампера',
  'Frontschürze': 'Передній бампер',
  'Heckspoiler': 'Задній спойлер',
  'Heckdiffusor': 'Задній дифузор',
  'Heckschürzenaufsatz': 'Накладка на задній бампер',
  'Heckschürzeneinsatz': 'Вставка заднього бампера',
  'Hecktüraufsatz': 'Накладка задніх дверей',
  'Heckleuchten': 'Задні фари',
  'Unterfahrschutz': 'Захист днища',
  'Spiegelkappen': 'Накладки на дзеркала',
  'Seitenleisten': 'Бічні молдинги',
  'Seitenschwelleraufsätze': 'Накладки на пороги',
  'Kotflügelaufsätze': 'Розширювачі крил',
  'Radhausverbreiterungen': 'Розширення арок',
  'Kühlergrill': 'Решітка радіатора',
  'Türgriffe': 'Дверні ручки',
  'Reserverad-Abdeckung': 'Кришка запасного колеса',
  'Kennzeichenhalter': 'Рамка номерного знака',
  'Dachgepäckträger': 'Багажник на дах',
  'Heckleiter': 'Задня драбина',
  'Windabweiser': 'Вітровідбійник',
  'Endrohrblenden': 'Насадки на вихлоп',
  'Endrohr-Blenden': 'Накладки на патрубки',
  'Auspuffblenden': 'Накладки на вихлоп',
  // Power & Sound
  'Sportauspuff': 'Спортивний вихлоп',
  'Klappen-Sportauspuffanlage': 'Спортивна вихлопна система з клапанами',
  'Sportfedern': 'Спортивні пружини',
  'Tieferlegungsmodul': 'Модуль зниження',
  'Leistungskit': 'Комплект потужності',
  // Interior
  'Pedalauflagen': 'Накладки на педалі',
  'Schaltwippen': 'Підрульові лепестки',
  'Einstiegsleisten': 'Порогові накладки',
  'Fußbodenschoner': 'Килимки підлоги',
  'Fußstütze': 'Підставка для ніг',
  'Sonnenblenden': 'Сонцезахисні козирки',
  'Dachkonsole': 'Стельова консоль',
  'Kofferraummatte': 'Килимок багажника',
  'Trennwand': 'Перегородка',
  'Leder': 'Шкіра',
  'Vollleder-Komplettausstattung': 'Повна шкіряна обробка',
  'Innenausstattung': 'Пакет інтер\'єру',
  // Wheels
  'Ventilkappen': 'Ковпачки вентилів',
  'Nabenkappe': 'Ковпак маточини',
  'Nabenkappen': 'Ковпаки маточини',
  // Materials & finishes
  'Carbon': 'Carbon',
  'Aluminium': 'Алюміній',
  'Velours': 'Велюр',
  'Velour': 'Велюр',
  'glänzend': 'Глянцевий',
  'matt': 'Матовий',
  'Sicht-Carbon': 'Відкритий Carbon',
  'Höhenverstellbar': 'з регулюванням висоти',
  'feststehend': 'Нерухомі',
  'Aufsatz': 'Накладка',
  'Einsätze': 'Вставки',
  'Einsätzen': 'Вставки',
  // Special
  'Sonderschutzpanzerung': 'Бронезахист',
  'Fahrwerk': 'Підвіска',
  'mit LED Scheinwerfern': 'з LED фарами',
  'mit LED Tagfahrlicht': 'з LED денними вогнями',
  'mit LED': 'з LED',
  'BRABUS Car Cover': 'Чохол BRABUS',
  'Easy entry': 'Полегшений вхід',
  'Light Carpet': 'Світловий килим',
  'Masterpiece Interieur': 'Masterpiece Інтер\'єр',
  'Interieur Accessoires Package': 'Пакет аксесуарів інтер\'єру',
  'Carbonpaket Innenraum': 'Карбоновий пакет салону',
  'Package Body & Sound': 'Пакет Body & Sound',
  'Türfangbänder': 'Обмежувачі дверей',
  'Start-Stop Memory': 'Start-Stop Memory',
};

// Clean product title: remove subtitle like "für Mercedes – W 465 – G 450 - G 500"
function cleanProductTitle(rawTitle) {
  if (!rawTitle) return '';
  // Remove everything after "für Mercedes" or "für" followed by brand
  let clean = rawTitle
    .replace(/\s*für\s+Mercedes.*$/i, '')
    .replace(/\s*für\s+Porsche.*$/i, '')
    .replace(/\s*für\s+Bentley.*$/i, '')
    .replace(/\s*für\s+Lamborghini.*$/i, '')
    .replace(/\s*für\s+Range.*$/i, '')
    .replace(/\s*für\s+Rolls.*$/i, '')
    .replace(/\s*für\s+smart.*$/i, '')
    .replace(/^Package/i, '') // Remove leading "Package" prefix
    .trim();
  return clean || rawTitle.trim();
}

function translateTitle(titleDe, termMap) {
  let result = cleanProductTitle(titleDe);
  // Sort by length desc to match longer phrases first
  const sorted = Object.entries(termMap).sort((a, b) => b[0].length - a[0].length);
  for (const [de, translated] of sorted) {
    result = result.replace(new RegExp(de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), translated);
  }
  // Clean up remaining German prepositions
  return result.trim();
}

function translateTitleEn(titleDe) {
  let result = translateTitle(titleDe, TERM_MAP_DE_EN);
  result = result.replace(/\s+für\s+/gi, ' for ').replace(/\s+mit\s+/gi, ' with ');
  return result;
}

function translateTitleUa(titleDe) {
  let result = translateTitle(titleDe, TERM_MAP_DE_UA);
  result = result.replace(/\s+für\s+/gi, ' для ').replace(/\s+mit\s+/gi, ' з ');
  return result;
}

// Blacklisted description fragments
const DESC_REMOVE_PATTERNS = [
  /Der Artikel ist anfragbar[^.]*/gi,
  /Dieser Artikel ist beratungsintensiv[^.]*/gi,
  /weil es Individualisierungsmöglichkeiten[^.]*/gi,
  /Er wird deshalb als[^.]*/gi,
  /ein BRABUS Berater kontaktiert Sie[^.]*/gi,
  /Wir schaffen modernen[^.]*/gi,
  /Wir schaffen individuellen[^.]*/gi,
];

// German words that should NOT appear in final EN/UA descriptions
const STILL_GERMAN = /\b(für|und|der|die|das|mit|aus|zur|zum|dem|den|auf|ist|ein|eine|des|sich|oder|werden|wird|nicht|bei|nach|wie|über|durch|nach|vor|kann|als|auch|nur|noch|so|vom|können|seine|seiner|Ihres|diesem|diesem|Ihrem|Ihren)\b/i;

function translateDescription(descDe, lang) {
  if (!descDe || descDe.length < 10) return '';
  
  // Remove blacklisted fragments first
  let result = descDe;
  for (const pattern of DESC_REMOVE_PATTERNS) {
    result = result.replace(pattern, '').trim();
  }
  
  // If result is now too short or empty, return empty
  if (result.length < 15) return '';
  
  // Basic term substitution
  const map = lang === 'ua' ? TERM_MAP_DE_UA : TERM_MAP_DE_EN;
  const sorted = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [de, translated] of sorted) {
    result = result.replace(new RegExp(de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), translated);
  }
  
  // Clean up whitespace
  result = result.replace(/\s+/g, ' ').trim();
  
  // Quality check: if still has many German words, the translation is bad — return empty
  const germanWordCount = (result.match(STILL_GERMAN) || []).length;
  const totalWords = result.split(/\s+/).length;
  if (totalWords > 5 && germanWordCount / totalWords > 0.15) {
    return ''; // Too much German left, better to show nothing than garbled text
  }
  
  return result;
}

// ─── Collection determination by vehicle class + brand ──────────────
function determineCollection(product) {
  const { klasse, chassis, baseBrand } = product;
  
  if (baseBrand === 'Mercedes') {
    const handle = `brabus-${klasse.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-klasse/, '')}`;
    return {
      handle,
      titleEn: `BRABUS ${klasse} ${chassis || ''}`.trim(),
      titleUa: `BRABUS ${klasse} ${chassis || ''}`.trim(),
      brand: 'Brabus',
    };
  }
  
  // Other brands
  const handle = `brabus-${baseBrand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return {
    handle,
    titleEn: `BRABUS × ${baseBrand}`,
    titleUa: `BRABUS × ${baseBrand}`,
    brand: 'Brabus',
  };
}

function generateSlug(sku) {
  const base = `brabus-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return base.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ─── Delete old Brabus products ─────────────────────────────────────
async function deleteOldBrabusProducts() {
  console.log('🗑️  Deleting old Brabus products...');
  
  // First get count
  const count = await prisma.shopProduct.count({ where: { brand: 'Brabus' } });
  console.log(`  Found ${count} old Brabus products to delete.`);
  
  if (count === 0) return;

  // Delete in cascading order
  // 1. Cart items referencing these products
  const productIds = (await prisma.shopProduct.findMany({
    where: { brand: 'Brabus' },
    select: { id: true },
  })).map(p => p.id);

  const cartDel = await prisma.shopCartItem.deleteMany({
    where: { productId: { in: productIds } },
  });
  console.log(`  Removed ${cartDel.count} cart items`);

  // 2. Delete products (cascades to variants, media, options, metafields, collections)
  const prodDel = await prisma.shopProduct.deleteMany({
    where: { brand: 'Brabus' },
  });
  console.log(`  Deleted ${prodDel.count} products`);

  // 3. Clean up empty Brabus collections
  const emptyColls = await prisma.shopCollection.findMany({
    where: { brand: 'Brabus', products: { none: {} } },
    select: { id: true, handle: true },
  });
  if (emptyColls.length > 0) {
    await prisma.shopCollection.deleteMany({
      where: { id: { in: emptyColls.map(c => c.id) } },
    });
    console.log(`  Removed ${emptyColls.length} empty collections`);
  }

  console.log('  ✅ Old Brabus data cleaned');
}

// ─── Import new products ────────────────────────────────────────────
async function importProducts(products, isDryRun) {
  console.log(`\n📦 Importing ${products.length} products...`);
  
  let created = 0, updated = 0, errors = 0;
  const collectionCache = {};

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      // Use titleDe (short name) rather than titleDeFull (which includes subtitle)
      const rawTitle = p.titleDe || p.titleDeFull || '';
      const titleEn = translateTitleEn(rawTitle) || rawTitle;
      const titleUa = translateTitleUa(rawTitle) || rawTitle;
      const descEn = p.descriptionEn || translateDescription(p.descriptionDe, 'en');
      const descUa = p.descriptionUa || translateDescription(p.descriptionDe, 'ua');
      const slug = generateSlug(p.sku);
      
      // Collection
      const coll = determineCollection(p);
      
      // Use local images if available, otherwise remote
      const mainImage = p.localMainImage || p.listingImage || null;
      const gallery = (p.localImages || p.galleryImages || []).slice(0, 8);
      
      if (isDryRun) {
        if (i < 5) {
          console.log(`  [DRY] ${slug}`);
          console.log(`    EN: ${titleEn}`);
          console.log(`    UA: ${titleUa}`);
          console.log(`    Price: €${p.priceEur}`);
          console.log(`    Images: ${gallery.length}`);
          console.log(`    Collection: ${coll.handle}`);
          console.log(`    Desc (EN, ${descEn.length}ch): ${descEn.substring(0, 100)}...`);
        }
        created++;
        continue;
      }

      // Ensure collection exists
      if (!collectionCache[coll.handle]) {
        const existing = await prisma.shopCollection.findUnique({
          where: { handle: coll.handle },
        });
        if (existing) {
          collectionCache[coll.handle] = existing.id;
        } else {
          const newColl = await prisma.shopCollection.create({
            data: {
              handle: coll.handle,
              titleEn: coll.titleEn,
              titleUa: coll.titleUa,
              brand: 'Brabus',
              isPublished: true,
            },
          });
          collectionCache[coll.handle] = newColl.id;
          console.log(`  📁 Created collection: ${coll.handle}`);
        }
      }

      const productData = {
        slug,
        sku: p.sku,
        scope: 'auto',
        brand: 'Brabus',
        vendor: 'Brabus',
        productType: 'Premium Tuning',
        productCategory: p.klasse,
        status: 'ACTIVE',
        titleUa: titleUa || p.titleDe,
        titleEn: titleEn || p.titleDe,
        bodyHtmlUa: descUa || null,
        bodyHtmlEn: descEn || null,
        shortDescUa: titleUa,
        shortDescEn: titleEn,
        stock: 'inStock',
        collectionUa: coll.titleUa,
        collectionEn: coll.titleEn,
        priceEur: p.priceEur || 0,
        image: mainImage,
        gallery: gallery.length > 0 ? gallery : undefined,
        isPublished: true,
        tags: ['Brabus', 'Tuning', p.baseBrand, p.klasse, p.chassis || '', p.categoryDe || ''].filter(Boolean),
        seoTitleEn: `${titleEn} | BRABUS Tuning`,
        seoTitleUa: `${titleUa} | BRABUS Тюнінг`,
        seoDescriptionEn: descEn.substring(0, 160) || `${titleEn} — premium BRABUS tuning for ${p.klasse}`,
        seoDescriptionUa: descUa.substring(0, 160) || `${titleUa} — преміум тюнінг BRABUS для ${p.klasse}`,
      };

      const existingProduct = await prisma.shopProduct.findFirst({
        where: {
          OR: [
            { slug },
            { sku: p.sku },
          ],
        },
        select: { id: true },
      });

      if (existingProduct) {
        await prisma.shopProduct.update({
          where: { id: existingProduct.id },
          data: {
            ...productData,
            collections: {
              deleteMany: {},
              create: {
                collectionId: collectionCache[coll.handle],
              },
            },
            variants: {
              deleteMany: {},
              create: [{
                title: 'Default',
                sku: p.sku,
                position: 1,
                inventoryQty: 0,
                priceEur: p.priceEur || 0,
                requiresShipping: true,
                image: mainImage,
                isDefault: true,
              }],
            },
            media: {
              deleteMany: {},
              ...(gallery.length > 0 ? {
                create: gallery.map((img, idx) => ({
                  src: img,
                  altText: `${titleEn} - Image ${idx + 1}`,
                  position: idx + 1,
                  mediaType: 'IMAGE',
                })),
              } : {}),
            },
          },
        });
        updated++;
      } else {
        await prisma.shopProduct.create({
          data: {
            ...productData,
            collections: {
              create: {
                collectionId: collectionCache[coll.handle],
              },
            },
            variants: {
              create: [{
                title: 'Default',
                sku: p.sku,
                position: 1,
                inventoryQty: 0,
                priceEur: p.priceEur || 0,
                requiresShipping: true,
                image: mainImage,
                isDefault: true,
              }],
            },
            media: gallery.length > 0 ? {
              create: gallery.map((img, idx) => ({
                src: img,
                altText: `${titleEn} - Image ${idx + 1}`,
                position: idx + 1,
                mediaType: 'IMAGE',
              })),
            } : undefined,
          },
        });
        created++;
      }

      if (i % 50 === 0) {
        console.log(`  [${i + 1}/${products.length}] Created: ${created} | Updated: ${updated} | Errors: ${errors}`);
      }
    } catch (err) {
      errors++;
      if (err.code === 'P2002') {
        // Duplicate slug — skip silently
        continue;
      }
      console.error(`  ✗ Error on SKU ${p.sku}: ${err.message}`);
    }
  }

  return { created, updated, errors };
}

// ─── MAIN ───────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const doDelete = args.includes('--delete-old');
  const limitMatch = args.find(a => a.startsWith('--limit='));
  const limit = limitMatch ? parseInt(limitMatch.split('=')[1]) : 0;

  console.log('═══════════════════════════════════════════════');
  console.log(' BRABUS Product Importer');
  console.log(`  Dry run: ${isDryRun}`);
  console.log(`  Delete old: ${doDelete}`);
  console.log(`  Limit: ${limit || 'ALL'}`);
  console.log('═══════════════════════════════════════════════\n');

  // Load scraped data (use translated if available, fallback to raw)
  const translatedPath = join(process.cwd(), 'data', 'brabus-products-translated.json');
  const rawPath = join(process.cwd(), 'data', 'brabus-products-raw.json');
  const dataPath = existsSync(translatedPath) ? translatedPath : rawPath;
  const rawProducts = JSON.parse(readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${rawProducts.length} products from ${dataPath}`);

  const products = limit ? rawProducts.slice(0, limit) : rawProducts;

  // Step 1: Delete old products
  if (doDelete && !isDryRun) {
    await deleteOldBrabusProducts();
  }

  // Step 2: Import new products
  const result = await importProducts(products, isDryRun);

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`✅ Import complete!`);
  console.log(`  Created: ${result.created}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Errors: ${result.errors}`);
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
