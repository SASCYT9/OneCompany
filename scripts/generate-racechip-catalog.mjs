/**
 * RaceChip GTS 5 Catalog Generator
 *
 * Parses ALL vehicle URLs from racechip-progress.json (sitemap data).
 * Extracts make/model/engine/specs directly from URL structure.
 * Generates rich product entries ready for DB import.
 *
 * Rules:
 *  - Always GTS 5 tier
 *  - Always App Control included in price
 *  - Price: 479€ (GTS 5) + 59€ (App Control) = 538€
 *  - Estimated gains: ~20% HP, ~23% Nm (typical GTS 5)
 */

import fs from 'fs';
import path from 'path';

const PROGRESS_FILE = path.join(process.cwd(), 'data', 'racechip-progress.json');
const OUTPUT_FILE   = path.join(process.cwd(), 'data', 'racechip-products.json');

const TOTAL_PRICE_EUR = 538; // 479 GTS5 + 59 App Control
const HP_GAIN_RATIO   = 0.20;
const NM_GAIN_RATIO   = 0.23;

const GTS5_IMAGES = [
  'https://www.racechip.eu/media/wysiwyg/product_overlay/gts-three-quarter.png',
  'https://www.racechip.eu/media/wysiwyg/pdp_images/product-gts-connect_shop.png',
  'https://www.racechip.eu/media/wysiwyg/products_menu/gts.jpg',
];

// ─── Name Formatting ─────────────────────────────────────────

const MAKE_MAP = {
  'bmw': 'BMW', 'vw': 'VW', 'ds': 'DS', 'mg': 'MG', 'mini': 'MINI',
  'gmc': 'GMC', 'ram': 'RAM', 'mercedes-benz': 'Mercedes-Benz',
  'alfa-romeo': 'Alfa Romeo', 'aston-martin': 'Aston Martin',
  'land-rover': 'Land Rover', 'rolls-royce': 'Rolls-Royce',
};

function fmtMake(slug) {
  if (MAKE_MAP[slug]) return MAKE_MAP[slug];
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function fmtModel(slug) {
  let n = slug
    .replace(/-\d{4}-to-\d{4}$/, '')
    .replace(/-from-\d{4}$/, '')
    .replace(/_/g, '/')
    .replace(/-/g, ' ');
  // Process each word, handling / separators within words (e.g. g30/g31)
  return n.split(' ').map(w => {
    // If word contains /, process each sub-part
    if (w.includes('/')) {
      return w.split('/').map(sub => fmtWord(sub)).join('/');
    }
    return fmtWord(w);
  }).join(' ');
}

function fmtWord(w) {
  if (!w) return w;
  if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(w)) return w.toUpperCase();
  if (/^[a-z]\d+$/i.test(w)) return w.toUpperCase();
  if (/^\d+$/.test(w)) return w;
  return w[0].toUpperCase() + w.slice(1);
}

function extractYears(slug) {
  let m = slug.match(/(\d{4})-to-(\d{4})$/);
  if (m) return `${m[1]}–${m[2]}`;
  m = slug.match(/from-(\d{4})$/);
  if (m) return `${m[1]}+`;
  return '';
}

const ENGINE_FIXES = [
  [/\bTdci\b/g,'TDCi'],[/\bTdi\b/g,'TDi'],[/\bTsi\b/g,'TSI'],[/\bTfsi\b/g,'TFSI'],
  [/\bEcoboost\b/g,'EcoBoost'],[/\bEcoblue\b/g,'EcoBlue'],[/\bMultijet\b/g,'MultiJet'],
  [/\bJtd\b/g,'JTD'],[/\bHpi\b/g,'HPI'],[/\bHpt\b/g,'HPT'],[/\bMzr\b/g,'MZR'],
  [/\bCdti\b/g,'CDTi'],[/\bCrdi\b/g,'CRDi'],[/\bDci\b/g,'dCi'],[/\bHdi\b/g,'HDi'],
  [/\bMhev\b/g,'MHEV'],[/\bPhev\b/g,'PHEV'],[/\bCtdi\b/g,'CTDi'],[/\bDtec\b/g,'DTEC'],
  [/\bCtec\b/g,'CTEC'],[/\bCdi\b/g,'CDI'],[/\bCrd\b/g,'CRD'],[/\bLpg\b/g,'LPG'],
  [/\bAmg\b/g,'AMG'],[/\bSvr\b/g,'SVR'],[/\bAwd\b/g,'AWD'],[/\bTwinair\b/g,'TwinAir'],
  [/\bSkyactiv\b/gi,'SKYACTIV'],[/\bVct\b/g,'VCT'],[/\bSt\b/g,'ST'],[/\bRs\b/g,'RS'],
];

function fmtEngine(slug) {
  let n = slug.replace(/^(\d+)-(\d+)/, '$1.$2').replace(/-/g, ' ');
  n = n.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  for (const [re, rep] of ENGINE_FIXES) n = n.replace(re, rep);
  return n;
}

// ─── Description Builder ─────────────────────────────────────

function buildDescEn(make, model, engine, ccm, baseHp, baseKw, baseNm, gainHp, gainNm) {
  const tunedHp = baseHp + gainHp;
  const tunedNm = baseNm + gainNm;
  return `<div class="rc-product">
<h3>RaceChip GTS 5 for ${make} ${model} ${engine}</h3>
<p class="rc-highlight" style="color:#ff6600;font-weight:bold;">
✅ App Control INCLUDED — control your chip tuning directly from your smartphone!</p>
<table class="rc-specs">
<tr><th colspan="2">Performance Specifications</th></tr>
<tr><td>Original Power</td><td><strong>${baseHp} HP</strong> (${baseKw} kW)</td></tr>
<tr><td>Tuned Power (up to)</td><td><strong>${tunedHp} HP</strong> (+${gainHp} HP)</td></tr>
<tr><td>Original Torque</td><td><strong>${baseNm} Nm</strong></td></tr>
<tr><td>Tuned Torque (up to)</td><td><strong>${tunedNm} Nm</strong> (+${gainNm} Nm)</td></tr>
<tr><td>Displacement</td><td>${ccm} cm³</td></tr>
</table>
<h4>What's Included</h4>
<ul>
<li>✅ RaceChip GTS 5 chip tuning module</li>
<li>✅ App Control — smartphone tuning management (included in price!)</li>
<li>7 fine tuning mappings for precise customization</li>
<li>RaceChip Safety Package</li>
<li>2-year engine warranty (up to €5,000)</li>
<li>1× free re-programming when you change your car</li>
<li>Up to 15% fuel savings in eco mode</li>
<li>Easy Plug & Play installation — no ECU modification required</li>
</ul></div>`;
}

function buildDescUa(make, model, engine, ccm, baseHp, baseKw, baseNm, gainHp, gainNm) {
  const tunedHp = baseHp + gainHp;
  const tunedNm = baseNm + gainNm;
  return `<div class="rc-product">
<h3>RaceChip GTS 5 для ${make} ${model} ${engine}</h3>
<p class="rc-highlight" style="color:#ff6600;font-weight:bold;">
✅ App Control ВКЛЮЧЕНО — керуйте чіп-тюнінгом прямо зі смартфона!</p>
<table class="rc-specs">
<tr><th colspan="2">Характеристики</th></tr>
<tr><td>Оригінальна потужність</td><td><strong>${baseHp} к.с.</strong> (${baseKw} кВт)</td></tr>
<tr><td>Потужність з тюнінгом (до)</td><td><strong>${tunedHp} к.с.</strong> (+${gainHp} к.с.)</td></tr>
<tr><td>Оригінальний крутний момент</td><td><strong>${baseNm} Нм</strong></td></tr>
<tr><td>Крутний момент з тюнінгом (до)</td><td><strong>${tunedNm} Нм</strong> (+${gainNm} Нм)</td></tr>
<tr><td>Об'єм двигуна</td><td>${ccm} см³</td></tr>
</table>
<h4>Що входить</h4>
<ul>
<li>✅ Модуль чіп-тюнінгу RaceChip GTS 5</li>
<li>✅ App Control — керування зі смартфона (включено в ціну!)</li>
<li>7 режимів тонкого налаштування для точної настройки</li>
<li>Пакет безпеки RaceChip</li>
<li>Гарантія на двигун 2 роки (до €5,000)</li>
<li>1× безкоштовне перепрограмування при зміні авто</li>
<li>Економія палива до 15% в еко-режимі</li>
<li>Проста установка Plug & Play — без модифікації ЕБУ</li>
</ul></div>`;
}

// ─── Main ────────────────────────────────────────────────────

function parseUrl(url) {
  const shopPart = url.split('/shop/')[1];
  if (!shopPart) return null;

  const parts = shopPart.replace(/\.html$/, '').split('/');
  if (parts.length < 3) return null;

  const [makeSlug, modelSlug, engineSlug] = parts;

  // Parse engine specs from slug: {name}-{ccm}ccm-{hp}hp-{kw}kw-{nm}nm
  const em = engineSlug.match(/^(.+?)-(\d+)ccm-(\d+)hp-(\d+)kw-(\d+)nm$/);
  if (!em) return null;

  const baseHp = parseInt(em[3]);
  const baseKw = parseInt(em[4]);
  const baseNm = parseInt(em[5]);
  const ccm    = parseInt(em[2]);

  const gainHp = Math.round(baseHp * HP_GAIN_RATIO);
  const gainNm = Math.round(baseNm * NM_GAIN_RATIO);

  const make   = fmtMake(makeSlug);
  const model  = fmtModel(modelSlug);
  const years  = extractYears(modelSlug);
  const engine = fmtEngine(em[1]);

  const titleEn = `RaceChip GTS 5 for ${make} ${model} ${engine} ${ccm} cm³`;
  const titleUa = `RaceChip GTS 5 для ${make} ${model} ${engine} ${ccm} см³`;

  const slug = `racechip-gts5-${makeSlug}-${modelSlug}-${engineSlug}`.substring(0, 120);
  const sku  = `RC5-${makeSlug.substring(0,4).toUpperCase()}-${engineSlug.substring(0,12).toUpperCase()}`;

  return {
    url, slug, sku, makeSlug, modelSlug, engineSlug,
    make, model, years, engine, ccm, baseHp, baseKw, baseNm,
    gainHp, gainNm,
    selectedTier: 'GTS 5',
    hasAppControl: true,
    priceEUR: TOTAL_PRICE_EUR,
    titleEn, titleUa,
    longDescEn: buildDescEn(make, model, engine, ccm, baseHp, baseKw, baseNm, gainHp, gainNm),
    longDescUa: buildDescUa(make, model, engine, ccm, baseHp, baseKw, baseNm, gainHp, gainNm),
    images: GTS5_IMAGES,
    tags: [
      'brand:RaceChip', 'tier:GTS5', 'app_control:true',
      `car_make:${makeSlug}`, `car_model:${modelSlug}`, `car_engine:${engineSlug}`,
    ],
    timestamp: new Date().toISOString(),
  };
}

function main() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.error('❌ Progress file not found:', PROGRESS_FILE);
    process.exit(1);
  }

  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  const allUrls = [...new Set([...progress.crawled, ...progress.pending])];
  console.log(`📡 Total unique URLs from sitemap: ${allUrls.length}`);

  const products = [];
  let skipped = 0;

  for (const url of allUrls) {
    const p = parseUrl(url);
    if (p) {
      products.push(p);
    } else {
      skipped++;
    }
  }

  // Sort by make → model → engine for cleaner output
  products.sort((a, b) =>
    a.make.localeCompare(b.make) ||
    a.model.localeCompare(b.model) ||
    a.baseHp - b.baseHp
  );

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2));

  // Stats
  const makes = new Set(products.map(p => p.make));
  console.log(`\n✅ Generated ${products.length} RaceChip GTS 5 products`);
  console.log(`⏭️  Skipped ${skipped} unparseable URLs`);
  console.log(`🏭 ${makes.size} unique makes: ${[...makes].sort().join(', ')}`);
  console.log(`💰 Price per product: ${TOTAL_PRICE_EUR}€ (GTS 5 + App Control)`);
  console.log(`📁 Output: ${OUTPUT_FILE}`);
}

main();
