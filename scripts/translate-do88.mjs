/**
 * DO88 Product Translator
 * 
 * Post-processes the scraped do88-products.json to add:
 *   - titleEn (English)
 *   - titleUa (Ukrainian)
 *   - categoryEn / categoryUa
 *   - shortDescEn / shortDescUa
 *   - bodyHtmlEn / bodyHtmlUa
 * 
 * Uses a comprehensive Swedish → English → Ukrainian dictionary
 * for automotive performance parts terminology.
 * 
 * Usage: node scripts/translate-do88.mjs
 */

import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'do88-products.json');
const OUTPUT_FILE = path.join(process.cwd(), 'do88-products-translated.json');
const OUTPUT_CSV = path.join(process.cwd(), 'do88-products-translated.csv');

// ─── Swedish → English / Ukrainian Dictionary ────────────────────────
const DICT = {
  // ── Product types ────────
  'Silikonslang':       { en: 'Silicone Hose',        ua: 'Силіконовий патрубок' },
  'Vakuumslang':        { en: 'Vacuum Hose',           ua: 'Вакуумний шланг' },
  'Bränsleslang':       { en: 'Fuel Hose',             ua: 'Паливний шланг' },
  'Bränslepåfyllningsslang': { en: 'Fuel Filler Hose', ua: 'Шланг заправки пального' },
  'Luftslang':          { en: 'Air Hose',              ua: 'Повітряний шланг' },
  'Intercooler':        { en: 'Intercooler',           ua: 'Інтеркулер' },
  'Vattenkylare':       { en: 'Radiator',              ua: 'Радіатор' },
  'Oljekylare':         { en: 'Oil Cooler',            ua: 'Масляний радіатор' },
  'Motoroljekylare':    { en: 'Engine Oil Cooler',     ua: 'Масляний радіатор двигуна' },
  'Aluminiumrör':       { en: 'Aluminum Pipe',         ua: 'Алюмінієва труба' },
  'Aluminiumror':       { en: 'Aluminum Pipe',         ua: 'Алюмінієва труба' },
  'Aluminiumreducering':{ en: 'Aluminum Reducer',      ua: 'Алюмінієвий перехідник' },
  'Aluminiumplåt':      { en: 'Aluminum Plate',        ua: 'Алюмінієва пластина' },
  'Aluminiumplat':      { en: 'Aluminum Plate',        ua: 'Алюмінієва пластина' },
  'Slangkit':           { en: 'Hose Kit',              ua: 'Комплект патрубків' },
  'Insugsslang':        { en: 'Intake Hose',           ua: 'Впускний патрубок' },
  'Insug':              { en: 'Intake',                ua: 'Впуск' },
  'Kylarslangar':       { en: 'Radiator Hoses',        ua: 'Радіаторні патрубки' },
  'Kylarslang':         { en: 'Radiator Hose',         ua: 'Радіаторний патрубок' },
  'Dumpventil':         { en: 'Dump Valve',            ua: 'Дамп-клапан' },
  'Wastegate':          { en: 'Wastegate',             ua: 'Вейстгейт' },
  'Turbo':              { en: 'Turbo',                 ua: 'Турбо' },
  'BigPack':            { en: 'BigPack',               ua: 'BigPack' },
  'Avgasdelar':         { en: 'Exhaust Parts',         ua: 'Вихлопні деталі' },
  'Avgasbandage':       { en: 'Exhaust Wrap',          ua: 'Бинт глушника' },
  'Avgasklammer':       { en: 'Exhaust Clamp',         ua: 'Хомут вихлопу' },
  'Avgasupphängning':   { en: 'Exhaust Mount',         ua: 'Підвіс вихлопу' },
  'Dampare':            { en: 'Silencer',              ua: 'Глушник' },
  'Värmeskydd':         { en: 'Heat Shield',           ua: 'Теплозахист' },
  'Varmeskydd':         { en: 'Heat Shield',           ua: 'Теплозахист' },
  'Värmeskyddslang':    { en: 'Heat Shield Hose',      ua: 'Теплозахисний шланг' },
  'Varmeskyddslang':    { en: 'Heat Shield Hose',      ua: 'Теплозахисний шланг' },
  'Värmeskyddshylsa':   { en: 'Heat Shield Sleeve',    ua: 'Теплозахисна гільза' },
  'Varmeskyddshylsa':   { en: 'Heat Shield Sleeve',    ua: 'Теплозахисна гільза' },
  'Värmeskyddsbandage': { en: 'Heat Shield Wrap',      ua: 'Теплозахисний бинт' },
  'Varmeskyddsbandage': { en: 'Heat Shield Wrap',      ua: 'Теплозахисний бинт' },
  'Värmeisolerande':    { en: 'Heat Insulating',       ua: 'Теплоізоляційний' },
  'Varmeisolerande':    { en: 'Heat Insulating',       ua: 'Теплоізоляційний' },
  'Värmesköld':         { en: 'Heat Shield',           ua: 'Теплозахисний екран' },
  'Varmeskold':         { en: 'Heat Shield',           ua: 'Теплозахисний екран' },
  'Slangtillbehör':     { en: 'Hose Accessories',      ua: 'Аксесуари для шлангів' },
  'Slangtillbehor':     { en: 'Hose Accessories',      ua: 'Аксесуари для шлангів' },
  'Slangklamma':        { en: 'Hose Clamp',            ua: 'Хомут' },
  'Slangklammepaket':   { en: 'Hose Clamp Kit',        ua: 'Комплект хомутів' },
  'Fjäderslanglamma':   { en: 'Spring Hose Clamp',     ua: 'Пружинний хомут' },
  'Slangkoppling':      { en: 'Hose Coupling',         ua: "З'єднання шланга" },
  'Silikonhatt':        { en: 'Silicone Cap',          ua: 'Силіконова заглушка' },
  'Slanguttag':         { en: 'Hose Outlet',           ua: 'Вихід шланга' },
  'Plugg':              { en: 'Plug',                  ua: 'Заглушка' },
  'Dekal':              { en: 'Sticker',               ua: 'Наклейка' },
  'Reklamartiklar':     { en: 'Merchandise',           ua: 'Мерч' },
  'BMC':                { en: 'BMC',                   ua: 'BMC' },
  'Luftfilter':         { en: 'Air Filter',            ua: 'Повітряний фільтр' },
  'Rengoringskit':      { en: 'Cleaning Kit',          ua: 'Набір для чищення' },

  // ── Colors ────────
  'Blå':    { en: 'Blue',  ua: 'Синій' },
  'Bla':    { en: 'Blue',  ua: 'Синій' },
  'Svart':  { en: 'Black', ua: 'Чорний' },
  'Röd':    { en: 'Red',   ua: 'Червоний' },
  'Rod':    { en: 'Red',   ua: 'Червоний' },
  'Silver': { en: 'Silver', ua: 'Срібний' },
  'Guld':   { en: 'Gold',   ua: 'Золотий' },

  // ── Shapes / types ────────
  'Böjar':         { en: 'Bend',          ua: 'Коліно' },
  'Böjd':          { en: 'Bent',          ua: 'Кутовий' },
  'Koppling':      { en: 'Coupling',      ua: "З'єднання" },
  'Reducering':    { en: 'Reducer',       ua: 'Перехідник' },
  'Rak':           { en: 'Straight',      ua: 'Прямий' },
  'Raka':          { en: 'Straight',      ua: 'Прямий' },
  'Flexibel':      { en: 'Flexible',      ua: 'Гнучкий' },
  'Flexkoppling':  { en: 'Flex Coupling', ua: "Гнучке з'єднання" },
  'Hump':          { en: 'Hump',          ua: 'Хамп' },
  'T-koppling':    { en: 'T-Coupling',    ua: "Т-з'єднання" },
  'Y-koppling':    { en: 'Y-Coupling',    ua: "Y-з'єднання" },
  'Y-rör':         { en: 'Y-Pipe',        ua: 'Y-труба' },
  'T-rör':         { en: 'T-Pipe',        ua: 'Т-труба' },
  'Likbent':       { en: 'Equal Leg',     ua: 'Рівнобічний' },
  'Slät':          { en: 'Smooth',        ua: 'Гладкий' },
  'Armerad':       { en: 'Reinforced',    ua: 'Армований' },
  'Cobra head':    { en: 'Cobra Head',    ua: 'Cobra Head' },

  // ── Angles / measurements ────────
  'grader':  { en: 'degree', ua: 'градусів' },
  'Grader':  { en: 'Degree', ua: 'Градусів' },
  'kort radie':  { en: 'Short Radius', ua: 'Короткий радіус' },
  'lång radie':  { en: 'Long Radius',  ua: 'Довгий радіус' },
  'lang radie':  { en: 'Long Radius',  ua: 'Довгий радіус' },
  'extra lång':  { en: 'Extra Long',   ua: 'Подовжений' },
  'extra lang':  { en: 'Extra Long',   ua: 'Подовжений' },
  'metervara':   { en: 'Per Meter',    ua: 'Метраж' },
  'löpmeter':    { en: 'Per Meter',    ua: 'Погонний метр' },
  'lopmeter':    { en: 'Per Meter',    ua: 'Погонний метр' },
  'rulle':       { en: 'Roll',         ua: 'Рулон' },

  // ── Technical terms ────────
  'Rostfritt stål':   { en: 'Stainless Steel',   ua: 'Нержавіюча сталь' },
  'Rostfri':          { en: 'Stainless',          ua: 'Нержавіючий' },
  'Rostfritt':        { en: 'Stainless',          ua: 'Нержавіючий' },
  'Aluminium':        { en: 'Aluminum',           ua: 'Алюмінієвий' },
  'Silikon':          { en: 'Silicone',           ua: 'Силіконовий' },
  'Kardborre':        { en: 'Velcro',             ua: 'Липучка' },
  'Buntband':         { en: 'Cable Tie',          ua: 'Стяжка' },
  'Matta':            { en: 'Mat',                ua: 'Мат' },
  'Tejp':             { en: 'Tape',               ua: 'Стрічка' },
  'Bandage':          { en: 'Wrap',               ua: 'Бинт' },
  'Steg':             { en: 'Step',               ua: 'Крок' },
  'Uttag':            { en: 'Outlet',             ua: 'Вихід' },
  'Anslutning':       { en: 'Connection',         ua: "З'єднання" },
  'Gänga':            { en: 'Thread',             ua: 'Різьба' },
  'Ganga':            { en: 'Thread',             ua: 'Різьба' },
  'Metrisk':          { en: 'Metric',             ua: 'Метрична' },
  'Upphängning':      { en: 'Mount',              ua: 'Підвіс' },
  'Upphangning':      { en: 'Mount',              ua: 'Підвіс' },
  'Beslag':           { en: 'Bracket',            ua: 'Кронштейн' },
  'Klammer':          { en: 'Clamp',              ua: 'Хомут' },
  'Adapter':          { en: 'Adapter',            ua: 'Адаптер' },
  'Montering':        { en: 'Mounting',           ua: 'Монтаж' },
  'Fastsättningskit': { en: 'Mounting Kit',        ua: 'Монтажний комплект' },
  'Fastsattningskit': { en: 'Mounting Kit',        ua: 'Монтажний комплект' },
  'Cellpaket':         { en: 'Core',               ua: 'Сердечник' },
  'Luft-luft':         { en: 'Air-Air',            ua: 'Повітря-повітря' },
  'Luft-vatten':       { en: 'Air-Water',          ua: 'Повітря-вода' },
  'MERA':              { en: 'MERA',               ua: 'MERA' },
  'Performance':       { en: 'Performance',        ua: 'Performance' },
  'Racing':            { en: 'Racing',             ua: 'Racing' },
  'Stage':             { en: 'Stage',              ua: 'Stage' },

  // ── Categories (top-level) ────────
  'Modellanpassat':    { en: 'Vehicle Specific',   ua: 'Для авто' },
  'Motor / Tuning':    { en: 'Engine / Tuning',    ua: 'Двигун / Тюнінг' },
  'Motor':             { en: 'Engine',             ua: 'Двигун' },
  'Tuning':            { en: 'Tuning',             ua: 'Тюнінг' },
  'Silikonslang / slang': { en: 'Silicone Hose / Hose', ua: 'Силіконовий патрубок / Шланг' },

  // ── Other terms ────────
  'Polerad':     { en: 'Polished',   ua: 'Полірований' },
  'Polerade':    { en: 'Polished',   ua: 'Поліровані' },
  'Väggtjocklek':{ en: 'Wall Thickness', ua: 'Товщина стінки' },
  'Vaggtjocklek':{ en: 'Wall Thickness', ua: 'Товщина стінки' },
  'Bredd':       { en: 'Width',      ua: 'Ширина' },
  'Längd':       { en: 'Length',     ua: 'Довжина' },
  'Langd':       { en: 'Length',     ua: 'Довжина' },
  'Rad':         { en: 'Rows',      ua: 'Рядів' },
  'Grupp A':     { en: 'Group A',   ua: 'Група А' },
  'Replica':     { en: 'Replica',   ua: 'Репліка' },
  'Special':     { en: 'Special',   ua: 'Спеціальний' },
  'Extra':       { en: 'Extra',     ua: 'Додатковий' },
  'DKG':         { en: 'DCT',       ua: 'DCT' },
  'DCT':         { en: 'DCT',       ua: 'DCT' },
  'DSG':         { en: 'DSG',       ua: 'DSG' },
  'Automat':     { en: 'Automatic', ua: 'Автоматичний' },
  'Manuell':     { en: 'Manual',    ua: 'Механічний' },
  'Servo':       { en: 'Power Steering', ua: 'Підсилювач керма' },
  'Servokylare': { en: 'Power Steering Cooler', ua: 'Радіатор підсилювача керма' },
  'Front':       { en: 'Front',     ua: 'Передній' },
  'Sidomonterad':{ en: 'Side-Mounted', ua: 'Бічний' },
  'Kit':         { en: 'Kit',       ua: 'Комплект' },
  'kit':         { en: 'kit',       ua: 'комплект' },
  'för':         { en: 'for',       ua: 'для' },
  'med':         { en: 'with',      ua: 'з' },
  'och':         { en: 'and',       ua: 'та' },
  'till':        { en: 'to',        ua: 'до' },
  'utan':        { en: 'without',   ua: 'без' },
};

// Sort dictionary by key length (longest first) for correct multi-word matching
const SORTED_KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);

function translateText(text, lang) {
  if (!text) return '';
  let result = text;
  
  for (const key of SORTED_KEYS) {
    const replacement = DICT[key]?.[lang];
    if (!replacement) continue;
    
    // Use word-boundary-aware replacement
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<=^|\\s|[\\-\\/,.(])${escaped}(?=$|\\s|[\\-\\/,.)0-9])`, 'gi');
    result = result.replace(regex, replacement);
  }
  
  return result;
}

function translateCategory(category, lang) {
  if (!category) return '';
  return category.split(' > ').map(part => translateText(part.trim(), lang)).join(' > ');
}

function generateDescription(product, lang) {
  const title = lang === 'en' ? product.titleEn : product.titleUa;
  const category = lang === 'en' ? product.categoryEn : product.categoryUa;
  
  if (lang === 'en') {
    return `<p><strong>${title}</strong></p><p>High-quality performance part by DO88. Category: ${category}. Made in Sweden.</p>`;
  } else {
    return `<p><strong>${title}</strong></p><p>Високоякісна деталь від DO88. Категорія: ${category}. Зроблено в Швеції.</p>`;
  }
}

function generateShortDesc(product, lang) {
  const title = lang === 'en' ? product.titleEn : product.titleUa;
  if (lang === 'en') {
    return `DO88 ${title}. Premium quality, made in Sweden.`;
  } else {
    return `DO88 ${title}. Преміум якість, зроблено в Швеції.`;
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
  console.log('🌐 DO88 Product Translator');
  console.log('==========================\n');
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.error('   Run scrape-do88.mjs first.');
    process.exit(1);
  }
  
  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`📦 Loaded ${products.length} products\n`);
  
  let translated = 0;
  let unchanged = 0;
  
  const translatedProducts = products.map(p => {
    const titleEn = translateText(p.title, 'en');
    const titleUa = translateText(p.title, 'ua');
    const categoryEn = translateCategory(p.category, 'en');
    const categoryUa = translateCategory(p.category, 'ua');
    
    const wasTranslated = titleEn !== p.title || titleUa !== p.title;
    if (wasTranslated) translated++;
    else unchanged++;
    
    const result = {
      ...p,
      titleOriginal: p.title,
      titleEn,
      titleUa,
      categoryOriginal: p.category,
      categoryEn,
      categoryUa,
    };
    
    result.shortDescEn = generateShortDesc(result, 'en');
    result.shortDescUa = generateShortDesc(result, 'ua');
    result.bodyHtmlEn = generateDescription(result, 'en');
    result.bodyHtmlUa = generateDescription(result, 'ua');
    
    return result;
  });
  
  // Print some examples
  console.log('📝 Translation samples:\n');
  const samples = translatedProducts.filter(p => p.titleEn !== p.titleOriginal).slice(0, 15);
  for (const s of samples) {
    console.log(`  🇸🇪 ${s.titleOriginal}`);
    console.log(`  🇬🇧 ${s.titleEn}`);
    console.log(`  🇺🇦 ${s.titleUa}`);
    console.log(`  📂 ${s.categoryOriginal} → EN: ${s.categoryEn} | UA: ${s.categoryUa}`);
    console.log();
  }
  
  console.log(`\n📊 Results:`);
  console.log(`   Translated: ${translated}`);
  console.log(`   Unchanged (brand/model names): ${unchanged}`);
  
  // Write JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(translatedProducts, null, 2), 'utf-8');
  console.log(`\n💾 JSON: ${OUTPUT_FILE}`);
  
  // Write Shopify-compatible CSV with both languages
  const header = [
    'Handle', 'Title', 'Title UA', 'Body (HTML)', 'Body HTML UA',
    'Vendor', 'Product Category', 'Category UA', 'Type',
    'Tags', 'Published', 'Option1 Name', 'Option1 Value',
    'Variant SKU', 'Variant Price', 'Variant Compare At Price',
    'Image Src', 'Image Position', 'Status',
  ].join(',');

  const rows = translatedProducts.map(p => {
    const handle = `do88-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const topCat = p.categoryEn.split(' > ')[0] || 'Cooling';
    const tags = ['DO88', topCat].filter(Boolean).join(', ');
    
    return [
      escapeCSV(handle),
      escapeCSV(p.titleEn),
      escapeCSV(p.titleUa),
      escapeCSV(p.bodyHtmlEn),
      escapeCSV(p.bodyHtmlUa),
      'DO88',
      escapeCSV(p.categoryEn),
      escapeCSV(p.categoryUa),
      'Performance Part',
      escapeCSV(tags),
      'true',
      'Title',
      'Default Title',
      escapeCSV(p.sku),
      escapeCSV(String(p.priceEUR_final)),
      escapeCSV(String(p.priceEUR_raw)),
      escapeCSV(p.imageUrl),
      '1',
      'active',
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8');
  console.log(`   CSV: ${OUTPUT_CSV}`);
  
  console.log(`\n✨ Done! Import the translated CSV via Admin > Shop > Import.`);
}

main();
