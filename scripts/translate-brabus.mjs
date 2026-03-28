/**
 * Brabus Product Translator
 * 
 * Translates English Brabus titles/descriptions into Ukrainian using a static dictionary.
 * 
 * Usage: node scripts/translate-brabus.mjs
 */

import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'brabus-products.json');
const OUTPUT_FILE = path.join(process.cwd(), 'brabus-catalog.json');
const OUTPUT_CSV = path.join(process.cwd(), 'brabus-catalog.csv');

// EN -> UA Dictionary
const DICT = {
  // Types
  'Front Spoiler': 'Передній спойлер',
  'Rear Spoiler': 'Задній спойлер',
  'Rear Diffuser': 'Задній дифузор',
  'Diffuser': 'Дифузор',
  'Side Skirts': 'Бокові пороги',
  'Radiator Grille': 'Решітка радіатора',
  'Exhaust System': 'Вихлопна система',
  'Exhaust': 'Вихлоп',
  'Tailpipes': 'Насадки на вихлоп',
  'Wheels': 'Диски',
  'Wheel': 'Диск',
  'Alloy Wheels': 'Легкосплавні диски',
  'Forged Wheels': 'Ковані диски',
  'Hubcap': 'Ковпачок маточини',
  'Hub Cap': 'Ковпачок маточини',
  'Valve Caps': 'Ковпачки на ніпелі',
  'Entrance Panels': 'Накладки на пороги',
  'Door Lock Pins': 'Кнопки блокування дверей',
  'Pedal Pads': 'Накладки на педалі',
  'Floor Mats': 'Килимки',
  'Trunk Mat': 'Килимок у багажник',
  'Sport Exhaust': 'Спортивний вихлоп',
  'Suspension': 'Підвіска',
  'Lowering Kit': 'Комплект заниження',
  'Engine Cover': 'Кришка двигуна',
  'Carbon Fiber': 'Карбон',
  'Carbon': 'Карбонове волокно',
  'PowerXtra': 'Модуль збільшення потужності PowerXtra',
  'Performance Kit': 'Комплект збільшення потужності',
  'Valve-Controlled': 'Клапанна',
  'Gloss': 'Глянцевий',
  'Matte': 'Матовий',
  'Leather': 'Шкіра',
  'Alcantara': 'Алькантара',
  'Aluminum': 'Алюміній',
  'for': 'для',
  'with': 'з',
  'and': 'та',
  'Set': 'Комплект',
  'Left': 'Лівий',
  'Right': 'Правий',
  'Front': 'Передній',
  'Rear': 'Задній',
  'Insert': 'Вставка',
  'Attachment': 'Накладка',
  'Badge': 'Емблема',
  'Emblem': 'Логотип',
  'Lettering': 'Напис',
  'Illuminated': 'З підсвіткою',
};

const SORTED_KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);

function translateText(text) {
  if (!text) return '';
  let result = text;
  
  for (const key of SORTED_KEYS) {
    const replacement = DICT[key];
    if (!replacement) continue;
    
    // Ignore case for matching but use exact replacement
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<=^|\\s|\"|\')${escaped}(?=$|\\s|[\\-\\/,.()\"\'])`, 'gi');
    
    // Attempt to match casing (capitalize first letter if source was capitalized)
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase()) {
         return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement.toLowerCase();
    });
  }
  
  return result;
}

function generateDescription(product, lang) {
  const title = lang === 'en' ? product.title : product.titleUk;
  const category = product.category || 'Tuning';
  
  if (lang === 'en') {
    return `<p><strong>${title}</strong></p><p>Premium automotive tuning component. Category: ${category}. Originally manufactured by Brabus.</p>`;
  } else {
    return `<p><strong>${title}</strong></p><p>Преміальний компонент для тюнінгу. Категорія: ${category}. Вироблено Brabus (Німеччина).</p>`;
  }
}

function escapeCSV(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function main() {
  console.log('🌐 Brabus Localized Translator (Dictionary Mode)');
  console.log('==============================================\n');
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }
  
  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`📦 Loaded ${products.length} products\n`);
  
  let translatedCount = 0;
  
  const translatedProducts = products.map(p => {
    // Brabus titles are mostly in EN from our scrape script
    const titleEn = p.title || p.sku;
    const titleUk = translateText(titleEn);
    
    if (titleUk !== titleEn) translatedCount++;
    
    const result = {
      ...p,
      titleEn,
      titleUk,
      descriptionEn: generateDescription(p, 'en'),
      descriptionUk: generateDescription(p, 'uk'),
    };
    
    return result;
  });
  
  console.log(`\n📊 Translated ${translatedCount} of ${products.length} items using dictionary.`);
  
  // Save JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(translatedProducts, null, 2), 'utf-8');
  console.log(`💾 JSON: ${OUTPUT_FILE}`);
  
  // Export to Shopify CSV
  const header = [
    'Handle', 'Title', 'Title UA', 'Body (HTML)', 'Body HTML UA',
    'Vendor', 'Product Category', 'Type',
    'Tags', 'Published', 'Option1 Name', 'Option1 Value',
    'Variant SKU', 'Variant Price', 'Variant Compare At Price',
    'Image Src', 'Image Position', 'Status',
  ].join(',');

  const rows = translatedProducts.map(p => {
    const handle = `brabus-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const tags = ['Brabus', p.category].filter(Boolean).join(', ');
    const imageUrl = (p.images && p.images.length > 0) ? p.images[0] : '';
    
    return [
      escapeCSV(handle),
      escapeCSV(p.titleEn),
      escapeCSV(p.titleUk),
      escapeCSV(p.descriptionEn),
      escapeCSV(p.descriptionUk),
      'Brabus',
      escapeCSV(p.category),
      'Premium Tuning',
      escapeCSV(tags),
      'true',
      'Title',
      'Default Title',
      escapeCSV(p.sku),
      escapeCSV(String(p.priceEUR_final)),
      escapeCSV(String(p.priceEUR_raw)),
      escapeCSV(imageUrl),
      '1',
      'active',
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8');
  console.log(`💾 CSV: ${OUTPUT_CSV}`);
  console.log(`\n✨ Done! Ready for import.`);
}

main();
