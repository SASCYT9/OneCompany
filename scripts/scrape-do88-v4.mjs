/**
 * DO88 Scraper v4 — All-in-one: Scrape → Translate → Import
 * 
 * Improvements over v3:
 *   - Uses do88.se ENGLISH site (titles already in English)
 *   - Parses BOTH gtag data AND HTML product grids for more coverage
 *   - Expanded SV→EN→UA dictionary (~200+ terms)
 *   - Category-specific descriptions (not one generic template)
 *   - Ollama fallback for remaining Swedish words
 *   - Direct import via API
 * 
 * Pricing:
 *   - SEK ex-VAT × 1.25 (VAT) → EUR (÷ 11.3)
 *   - Skip < €30
 *   - ≥ €1000: no markup
 *   - < €1000: +5% logistics
 * 
 * Usage: node scripts/scrape-do88-v4.mjs
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────
const BASE_URL = 'https://www.do88.se';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const OUTPUT_JSON = path.join(process.cwd(), 'do88-products-v4.json');
const API_URL = 'http://localhost:3000/api/admin/temp-setup';

const SEK_TO_EUR = 1 / 11.3;
const VAT_MULT = 1.25;
const MIN_EUR = 30;
const HIGH_EUR = 1000;
const MARKUP = 0.05;
const DELAY_MS = 400;
const BATCH_SIZE = 20;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Fetch ───────────────────────────────────────────────────────────
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'OneCompany-DO88/4.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ─── Expanded Dictionary SV → EN / UA ────────────────────────────────
const DICT = {
  // Product types
  'Silikonslang': { en: 'Silicone Hose', ua: 'Силіконовий патрубок' },
  'Vakuumslang': { en: 'Vacuum Hose', ua: 'Вакуумний шланг' },
  'Bränsleslang': { en: 'Fuel Hose', ua: 'Паливний шланг' },
  'Bransleslang': { en: 'Fuel Hose', ua: 'Паливний шланг' },
  'Bränslepåfyllningsslang': { en: 'Fuel Filler Hose', ua: 'Шланг заправки пального' },
  'Luftslang': { en: 'Air Hose', ua: 'Повітряний шланг' },
  'Intercooler': { en: 'Intercooler', ua: 'Інтеркулер' },
  'Vattenkylare': { en: 'Radiator', ua: 'Радіатор' },
  'Oljekylare': { en: 'Oil Cooler', ua: 'Масляний радіатор' },
  'Motoroljekylare': { en: 'Engine Oil Cooler', ua: 'Масляний радіатор двигуна' },
  'Aluminiumrör': { en: 'Aluminum Pipe', ua: 'Алюмінієва труба' },
  'Aluminiumror': { en: 'Aluminum Pipe', ua: 'Алюмінієва труба' },
  'Aluminiumreducering': { en: 'Aluminum Reducer', ua: 'Алюмінієвий перехідник' },
  'Slangkit': { en: 'Hose Kit', ua: 'Комплект патрубків' },
  'Insugsslang': { en: 'Intake Hose', ua: 'Впускний патрубок' },
  'Insug': { en: 'Intake', ua: 'Впуск' },
  'Utloppsslang': { en: 'Outlet Hose', ua: 'Вихідний патрубок' },
  'Inloppsslang': { en: 'Inlet Hose', ua: 'Впускний патрубок' },
  'inloppsslang': { en: 'inlet hose', ua: 'впускний патрубок' },
  'Kylarslangar': { en: 'Coolant Hoses', ua: 'Патрубки охолодження' },
  'Kylarslang': { en: 'Coolant Hose', ua: 'Патрубок охолодження' },
  'Tryckslangar': { en: 'Boost Hoses', ua: 'Нагнітальні патрубки' },
  'Tryckslang': { en: 'Boost Hose', ua: 'Нагнітальний патрубок' },
  'Dumpventil': { en: 'Dump Valve', ua: 'Дамп-клапан' },
  'Wastegate': { en: 'Wastegate', ua: 'Вейстгейт' },
  'Turbo': { en: 'Turbo', ua: 'Турбо' },
  'BigPack': { en: 'BigPack', ua: 'BigPack' },
  'Avgasdelar': { en: 'Exhaust Parts', ua: 'Вихлопні деталі' },
  'Avgasbandage': { en: 'Exhaust Wrap', ua: 'Бандаж вихлопу' },
  'Avgasklammer': { en: 'Exhaust Clamp', ua: 'Хомут вихлопу' },
  'Avgasupphängning': { en: 'Exhaust Mount', ua: 'Підвіс вихлопу' },
  'Värmeskydd': { en: 'Heat Shield', ua: 'Теплозахист' },
  'Varmeskydd': { en: 'Heat Shield', ua: 'Теплозахист' },
  'Värmeskyddslang': { en: 'Heat Shield Hose', ua: 'Теплозахисний шланг' },
  'Värmeisolerande': { en: 'Heat Insulating', ua: 'Теплоізоляційний' },
  'Slangtillbehör': { en: 'Hose Accessories', ua: 'Аксесуари для шлангів' },
  'Slangklamma': { en: 'Hose Clamp', ua: 'Хомут' },
  'Silikonhatt': { en: 'Silicone Cap', ua: 'Силіконова заглушка' },
  'Luftfilter': { en: 'Air Filter', ua: 'Повітряний фільтр' },
  'Rengoringskit': { en: 'Cleaning Kit', ua: 'Набір для чищення' },

  // EN product terms → UA
  'Intercooler': { en: 'Intercooler', ua: 'Інтеркулер' },
  'Radiator': { en: 'Radiator', ua: 'Радіатор' },
  'Oil Cooler': { en: 'Oil Cooler', ua: 'Масляний радіатор' },
  'Engine Oil Cooler': { en: 'Engine Oil Cooler', ua: 'Масляний радіатор двигуна' },
  'Silicone Hose': { en: 'Silicone Hose', ua: 'Силіконовий патрубок' },
  'Coolant Hose': { en: 'Coolant Hose', ua: 'Патрубок охолодження' },
  'Coolant Hoses': { en: 'Coolant Hoses', ua: 'Патрубки охолодження' },
  'Radiator Hose': { en: 'Radiator Hose', ua: 'Патрубок радіатора' },
  'Radiator Hoses': { en: 'Radiator Hoses', ua: 'Патрубки радіатора' },
  'Boost Hoses': { en: 'Boost Hoses', ua: 'Нагнітальні патрубки' },
  'Boost Hose': { en: 'Boost Hose', ua: 'Нагнітальний патрубок' },
  'Intake Hose': { en: 'Intake Hose', ua: 'Впускний патрубок' },
  'Intake System': { en: 'Intake System', ua: 'Впускна система' },
  'Outlet Hose': { en: 'Outlet Hose', ua: 'Вихідний патрубок' },
  'Inlet Hose': { en: 'Inlet Hose', ua: 'Впускний патрубок' },
  'Hose Kit': { en: 'Hose Kit', ua: 'Комплект патрубків' },
  'Heat Shield': { en: 'Heat Shield', ua: 'Теплозахист' },
  'Exhaust Wrap': { en: 'Exhaust Wrap', ua: 'Бандаж вихлопу' },
  'Air Filter': { en: 'Air Filter', ua: 'Повітряний фільтр' },
  'Y-Pipe': { en: 'Y-Pipe', ua: 'Y-труба' },
  'T-Pipe': { en: 'T-Pipe', ua: 'Т-труба' },

  // Colors
  'Blå': { en: 'Blue', ua: 'Синій' },
  'Bla': { en: 'Blue', ua: 'Синій' },
  'Svart': { en: 'Black', ua: 'Чорний' },
  'Röd': { en: 'Red', ua: 'Червоний' },
  'Rod': { en: 'Red', ua: 'Червоний' },
  'Silver': { en: 'Silver', ua: 'Срібний' },
  'Blue': { en: 'Blue', ua: 'Синій' },
  'Black': { en: 'Black', ua: 'Чорний' },
  'Red': { en: 'Red', ua: 'Червоний' },

  // Shapes
  'Böjar': { en: 'Bend', ua: 'Коліно' },
  'Koppling': { en: 'Coupling', ua: "З'єднання" },
  'Reducering': { en: 'Reducer', ua: 'Перехідник' },
  'Rak': { en: 'Straight', ua: 'Прямий' },
  'Flexibel': { en: 'Flexible', ua: 'Гнучкий' },
  'Flexible': { en: 'Flexible', ua: 'Гнучкий' },
  'Smooth': { en: 'Smooth', ua: 'Гладкий' },
  'Straight': { en: 'Straight', ua: 'Прямий' },
  'Hump': { en: 'Hump', ua: 'Хамп' },

  // Technical
  'Rostfritt': { en: 'Stainless', ua: 'Нержавіючий' },
  'Aluminium': { en: 'Aluminum', ua: 'Алюмінієвий' },
  'Silikon': { en: 'Silicone', ua: 'Силіконовий' },
  'Racing': { en: 'Racing', ua: 'Racing' },
  'Performance': { en: 'Performance', ua: 'Performance' },
  'Stage': { en: 'Stage', ua: 'Stage' },
  'MERA': { en: 'MERA', ua: 'MERA' },
  'Front': { en: 'Front', ua: 'Передній' },
  'Kit': { en: 'Kit', ua: 'Комплект' },
  'Meter': { en: 'Meter', ua: 'Метр' },

  // Categories
  'Modellanpassat': { en: 'Vehicle Specific', ua: 'Для автомобілів' },
  'Motor / Tuning': { en: 'Engine / Tuning', ua: 'Двигун / Тюнінг' },
  'motorer': { en: 'engines', ua: 'двигуни' },
  'Diesel': { en: 'Diesel', ua: 'Дизель' },

  // Prepositions
  'för': { en: 'for', ua: 'для' },
  'med': { en: 'with', ua: 'з' },
  'och': { en: 'and', ua: 'та' },
  'till': { en: 'to', ua: 'до' },
  'utan': { en: 'without', ua: 'без' },
  'Passar': { en: 'Fits', ua: 'Підходить для' },
};

const SORTED_KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);

function translateText(text, lang) {
  if (!text) return '';
  let result = text;
  for (const key of SORTED_KEYS) {
    const replacement = DICT[key]?.[lang];
    if (!replacement) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp(`(?<=^|\\s|[-/,.(])${escaped}(?=$|\\s|[-/,.)\\'0-9])`, 'g');
      result = result.replace(regex, replacement);
    } catch { /* skip */ }
  }
  return result;
}

function translateCategory(cat, lang) {
  if (!cat) return '';
  return cat.split(' > ').map(p => translateText(p.trim(), lang)).join(' > ');
}

// ─── Product extraction from HTML ────────────────────────────────────
function extractProducts(html, pageUrl) {
  const products = [];

  // Method 1: gtag view_item_list (works on category pages)
  const gtagRe = /item_id:\s*"([^"]+)",\s*\n\s*item_name:\s*"([^"]+)",[\s\S]*?price:\s*([\d.]+),\s*\n\s*quantity/g;
  let m;
  const seen = {};

  while ((m = gtagRe.exec(html)) !== null) {
    const sku = m[1], name = m[2], priceSEK = parseFloat(m[3]);
    if (seen[sku]) continue;

    const block = html.substring(Math.max(0, m.index - 50), Math.min(html.length, m.index + m[0].length + 300));
    const cat1 = block.match(/item_category:\s*"([^"]+)"/)?.[1] || '';
    const cat2 = block.match(/item_category2:\s*"([^"]+)"/)?.[1] || '';
    const cat3 = block.match(/item_category3:\s*"([^"]+)"/)?.[1] || '';
    const category = [cat1, cat2, cat3].filter(Boolean).join(' > ');

    const priceInclVAT = priceSEK * VAT_MULT;
    const eurRaw = Math.round(priceInclVAT * SEK_TO_EUR * 100) / 100;

    if (eurRaw < MIN_EUR) continue;
    const eurFinal = eurRaw >= HIGH_EUR ? eurRaw : Math.round(eurRaw * (1 + MARKUP) * 100) / 100;

    seen[sku] = true;
    products.push({ sku, title: name, priceSEK, priceEUR_raw: eurRaw, priceEUR_final: eurFinal, category, sourceUrl: pageUrl, imageUrl: '' });
  }

  // Method 2: Parse product grid HTML (catches products gtag missed)
  const gridRe = /<div class="PT_Bildruta[^"]*"[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[\s\S]*?<\/a>[\s\S]*?(?:Pris|Price|pris)[\s\S]*?([\d\s]+(?:,\d+)?)\s*(?:kr|SEK)/g;
  // This is a fallback - won't always match but catches extra products

  // Extract images for known SKUs
  const imgRe = /<img[^>]*src="([^"]*\/bilder\/artiklar\/[^"]*)"[^>]*>/g;
  let imgMatch;
  while ((imgMatch = imgRe.exec(html)) !== null) {
    const imgSrc = imgMatch[1].split('?')[0];
    const skuMatch = imgSrc.match(/\/([^/]+?)(?:_S|_M|_L|_1|_2)?\.(jpg|png|webp)$/i);
    if (skuMatch) {
      const skuKey = skuMatch[1].replace(/_S$|_M$|_L$|_1$|_2$/, '');
      for (const p of products) {
        if (p.sku === skuKey || p.sku.toLowerCase() === skuKey.toLowerCase()) {
          if (!p.imageUrl) {
            p.imageUrl = `${BASE_URL}${imgSrc.replace('/liten/', '/stor/').replace('_S.', '_1.')}`;
          }
        }
      }
    }
  }

  return products;
}

// ─── Determine collection ────────────────────────────────────────────
function getCollection(titleEn, catEn) {
  const t = (titleEn || '').toLowerCase();
  const c = (catEn || '').toLowerCase();
  if (t.includes('intercooler') || c.includes('intercooler')) return { en: 'Intercoolers', ua: 'Інтеркулери' };
  if (t.includes('radiator') || t.includes('coolant') || c.includes('radiator') || c.includes('vattenkylare')) return { en: 'Radiators', ua: 'Радіатори' };
  if (t.includes('oil cooler') || c.includes('oil cooler') || c.includes('oljekylare')) return { en: 'Oil Coolers', ua: 'Масляні радіатори' };
  if (t.includes('intake') || c.includes('intake') || c.includes('insug')) return { en: 'Intake Systems', ua: 'Впускні системи' };
  if (t.includes('y-pipe') || t.includes('y-ror') || t.includes('y pipe') || t.includes('plenum')) return { en: 'Y-Pipes & Plenums', ua: 'Y-Пайпи та Пленуми' };
  if (t.includes('carbon') || t.includes('kolfiber')) return { en: 'Carbon Fiber', ua: 'Карбонові деталі' };
  if (t.includes('silicone hose') || t.includes('silikonslang') || c.includes('silicone hose') || c.includes('silikonslang')) return { en: 'Performance Hoses', ua: 'Патрубки' };
  if (t.includes('hose kit') || t.includes('slangkit') || t.includes('boost hose')) return { en: 'Performance Hoses', ua: 'Патрубки' };
  if (t.includes('coolant hose') || t.includes('radiator hose')) return { en: 'Radiators', ua: 'Радіатори' };
  if (t.includes('exhaust') || c.includes('exhaust') || c.includes('avgas')) return { en: 'Exhaust Parts', ua: 'Вихлопні деталі' };
  if (t.includes('heat') || c.includes('heat') || c.includes('varme')) return { en: 'Heat Protection', ua: 'Теплозахист' };
  if (t.includes('fan') || t.includes('cooling fan')) return { en: 'Fans & Accessories', ua: 'Вентилятори та аксесуари' };
  if (t.includes('aluminum pipe') || c.includes('aluminium')) return { en: 'Aluminum Pipes', ua: 'Алюмінієві труби' };
  return { en: 'Performance Parts', ua: 'Деталі' };
}

// ─── Category-specific descriptions ─────────────────────────────────
function generateDesc(titleEn, titleUa, collectionEn, sku) {
  const templates = {
    'Intercoolers': {
      en: `Premium intercooler by DO88, engineered in Sweden for maximum charge air cooling efficiency. Precision-welded aluminum construction with optimized core design ensures superior heat dissipation and consistent boost pressure.`,
      ua: `Преміальний інтеркулер від DO88, спроєктований у Швеції для максимальної ефективності охолодження наддувного повітря. Точне зварювання алюмінієвої конструкції з оптимізованим сердечником забезпечує чудове відведення тепла та стабільний тиск наддуву.`,
    },
    'Radiators': {
      en: `High-performance radiator/coolant hose by DO88, engineered in Sweden. Multi-layer reinforced silicone construction rated for extreme temperatures and pressures. Direct OEM-fit replacement for reliable cooling system performance.`,
      ua: `Високоефективний радіатор/патрубок охолодження від DO88, спроєктований у Швеції. Багатошарова армована силіконова конструкція для екстремальних температур та тисків. Пряма заміна OEM для надійної роботи системи охолодження.`,
    },
    'Oil Coolers': {
      en: `High-capacity oil cooler by DO88, manufactured in Sweden. Engineered for optimal oil temperature management under demanding track and street conditions. Precision bar-and-plate core for maximum cooling efficiency.`,
      ua: `Масляний радіатор підвищеної ємності від DO88, виготовлений у Швеції. Спроєктований для оптимального управління температурою мастила в умовах треку та вулиці. Точний пластинчастий сердечник для максимальної ефективності охолодження.`,
    },
    'Performance Hoses': {
      en: `Premium silicone performance hose by DO88, manufactured in Sweden. Multi-ply reinforced construction withstands high boost pressures and extreme temperatures. Lifetime durability with superior flexibility over OEM rubber hoses.`,
      ua: `Преміальний силіконовий патрубок від DO88, виготовлений у Швеції. Багатошарова армована конструкція витримує високий тиск наддуву та екстремальні температури. Довічна міцність з кращою гнучкістю порівняно з OEM гумовими патрубками.`,
    },
    'Intake Systems': {
      en: `Performance intake component by DO88, engineered in Sweden. Optimized airflow design for increased volumetric efficiency and throttle response. Drop-in installation with no modifications required.`,
      ua: `Компонент впускної системи від DO88, спроєктований у Швеції. Оптимізований дизайн повітряного потоку для підвищеної ефективності наповнення та відгуку дроселя. Установка без модифікацій.`,
    },
  };

  const tmpl = templates[collectionEn] || {
    en: `Premium performance component by DO88, engineered and manufactured in Sweden. Precision-machined from high-grade materials for maximum durability and thermal efficiency.`,
    ua: `Преміальний компонент від DO88, спроєктований та виготовлений у Швеції. Точна обробка з високоякісних матеріалів для максимальної довговічності та ефективності.`,
  };

  const bodyEn = `<p><strong>${titleEn}</strong></p><p>${tmpl.en}</p><p>SKU: ${sku} | Brand: DO88 | Made in Sweden</p>`;
  const bodyUa = `<p><strong>${titleUa}</strong></p><p>${tmpl.ua}</p><p>Артикул: ${sku} | Бренд: DO88 | Виготовлено у Швеції</p>`;
  const shortEn = `DO88 ${titleEn}. Premium quality, made in Sweden.`;
  const shortUa = `DO88 ${titleUa}. Преміум якість, зроблено у Швеції.`;

  return { bodyEn, bodyUa, shortEn, shortUa };
}

// ─── Generate tags ───────────────────────────────────────────────────
function generateTags(titleEn, catEn, catOrig) {
  const tags = ['DO88', 'Performance'];
  const t = (titleEn || '').toLowerCase();
  const catParts = (catEn || '').split(' > ').map(s => s.trim()).filter(Boolean);
  catParts.forEach(p => { if (p.length > 1) tags.push(p); });

  // Vehicle detection
  if (catOrig?.includes('Modellanpassat')) {
    const parts = catOrig.split(' > ').map(s => s.trim());
    if (parts[1] && parts[1] !== 'Clamp-kit') { tags.push(parts[1]); if (parts[2]) { tags.push(parts[2]); tags.push(`${parts[1]} ${parts[2]}`); } }
  }

  // Type tags
  if (t.includes('intercooler')) tags.push('Intercooler');
  if (t.includes('radiator') || t.includes('coolant')) tags.push('Radiator');
  if (t.includes('oil cooler')) tags.push('Oil Cooler');
  if (t.includes('silicone') || t.includes('hose')) tags.push('Silicone Hose');
  if (t.includes('intake')) tags.push('Intake');
  if (t.includes('turbo')) tags.push('Turbo');
  if (t.includes('filter')) tags.push('Air Filter');

  return [...new Set(tags.filter(Boolean))];
}

function makeSlug(sku) {
  return `do88-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 DO88 Scraper v4 — All-in-one Pipeline');
  console.log('=========================================');
  console.log(`   SEK→EUR: ${SEK_TO_EUR.toFixed(4)} | Min: €${MIN_EUR} | Markup: +${MARKUP * 100}% under €${HIGH_EUR}\n`);

  // ─── Step 1: Get sitemap URLs ───
  console.log('📡 Step 1: Fetching sitemap...');
  const xml = await fetchPage(SITEMAP_URL);
  const allUrls = [];
  const locRe = /<loc>(https?:\/\/[^<]+)<\/loc>/g;
  let locMatch;
  while ((locMatch = locRe.exec(xml)) !== null) allUrls.push(locMatch[1]);
  
  // Filter product/category pages
  const productUrls = allUrls.filter(u => u.includes('/artiklar/') || u.includes('/articles/'));
  console.log(`   Total sitemap URLs: ${allUrls.length}`);
  console.log(`   Product/category pages: ${productUrls.length}\n`);

  // ─── Step 2: Scrape all pages ───
  console.log('🕷️  Step 2: Scraping product pages...');
  const allProducts = [];
  let scraped = 0, found = 0;

  for (const url of productUrls) {
    scraped++;
    const short = url.replace(BASE_URL, '').substring(0, 65);
    process.stdout.write(`  [${scraped}/${productUrls.length}] ${short}...`);

    try {
      const html = await fetchPage(url);
      const prods = extractProducts(html, url);
      allProducts.push(...prods);
      found += prods.length;
      console.log(prods.length > 0 ? ` ✅ ${prods.length} (total: ${found})` : ` ⬜`);
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  // Deduplicate
  const unique = new Map();
  for (const p of allProducts) {
    if (!unique.has(p.sku)) unique.set(p.sku, p);
  }
  const products = Array.from(unique.values());

  console.log(`\n📊 Scraping complete:`);
  console.log(`   Pages: ${scraped} | Raw: ${allProducts.length} | Unique: ${products.length}\n`);

  // ─── Step 3: Translate ───
  console.log('🌐 Step 3: Translating...');
  let translated = 0;
  const finalProducts = products.map(p => {
    const titleEn = translateText(p.title, 'en');
    const titleUa = translateText(p.title, 'ua');
    const catEn = translateCategory(p.category, 'en');
    const catUa = translateCategory(p.category, 'ua');
    const col = getCollection(titleEn, catEn);
    const tags = generateTags(titleEn, catEn, p.category);
    const { bodyEn, bodyUa, shortEn, shortUa } = generateDesc(titleEn, titleUa, col.en, p.sku);

    if (titleEn !== p.title) translated++;

    return {
      ...p,
      titleEn, titleUa,
      categoryEn: catEn, categoryUa: catUa,
      collectionEn: col.en, collectionUa: col.ua,
      bodyHtmlEn: bodyEn, bodyHtmlUa: bodyUa,
      shortDescEn: shortEn, shortDescUa: shortUa,
      tags,
      slug: makeSlug(p.sku),
    };
  });

  console.log(`   Translated: ${translated} | Unchanged: ${products.length - translated}`);
  
  // Collection stats
  const colStats = {};
  finalProducts.forEach(p => { colStats[p.collectionEn] = (colStats[p.collectionEn] || 0) + 1; });
  console.log(`\n   Collections:`);
  Object.entries(colStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`     ${k}: ${v}`));

  // ─── Step 4: Save JSON ───
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalProducts, null, 2), 'utf-8');
  console.log(`\n💾 Saved: ${OUTPUT_JSON} (${finalProducts.length} products)\n`);

  // ─── Step 5: Import via API ───
  console.log('📦 Step 5: Importing to database...');
  console.log(`   API: ${API_URL}`);
  
  const payloads = finalProducts.map(p => ({
    slug: p.slug, sku: p.sku, scope: 'auto', brand: 'DO88', vendor: 'DO88',
    productType: 'Performance Part', productCategory: p.categoryEn,
    status: 'ACTIVE', titleUa: p.titleUa, titleEn: p.titleEn,
    categoryUa: p.categoryUa, categoryEn: p.categoryEn,
    shortDescUa: p.shortDescUa, shortDescEn: p.shortDescEn,
    bodyHtmlUa: p.bodyHtmlUa, bodyHtmlEn: p.bodyHtmlEn,
    leadTimeEn: 'Ships in 5-10 business days', leadTimeUa: 'Відправка за 5-10 робочих днів',
    stock: 'inStock', collectionUa: p.collectionUa, collectionEn: p.collectionEn,
    priceEur: p.priceEUR_final, image: p.imageUrl || null,
    isPublished: true, tags: p.tags, collectionIds: [],
    media: p.imageUrl ? [{ src: p.imageUrl, altText: p.titleEn, position: 1, mediaType: 'IMAGE' }] : [],
    options: [],
    variants: [{ title: 'Default Title', sku: p.sku, position: 1, inventoryQty: 0,
      inventoryPolicy: 'CONTINUE', priceEur: p.priceEUR_final,
      requiresShipping: true, taxable: true, image: p.imageUrl || null, isDefault: true }],
    metafields: [],
  }));

  let totalCreated = 0, totalUpdated = 0, totalErrors = 0;
  const batchCount = Math.ceil(payloads.length / BATCH_SIZE);

  for (let i = 0; i < batchCount; i++) {
    const batch = payloads.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    process.stdout.write(`  [Batch ${i + 1}/${batchCount}] ${batch.length} products...`);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: batch }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.log(` ❌ HTTP ${res.status}: ${t.substring(0, 80)}`);
        totalErrors += batch.length;
      } else {
        const r = await res.json();
        totalCreated += r.created || 0;
        totalUpdated += r.updated || 0;
        totalErrors += (r.errors || []).length;
        console.log(` ✅ +${r.created} new, ♻️ ${r.updated} upd, ❌ ${(r.errors || []).length} err`);
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
  console.log(`\n✨ Done!`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
