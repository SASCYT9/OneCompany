#!/usr/bin/env node
/**
 * Read the scraped do88.se page data and produce do88ProductSpecs.ts entries.
 *
 * Strategy
 * --------
 * Translation is hard, but the *facts* on each scraped page are universal:
 *  - "−12 °C lower intake temperature" → numbers + units
 *  - "799 CFM (+8% vs OE)" → numbers
 *  - "105 mm core thickness" → number + unit
 *  - "OE: 992145805G ..." → identifiers
 *
 * We build Ukrainian (and English) descriptions from a template chosen by
 * product kind (intercooler, Big Pack, intake, hose kit…) and inject the
 * extracted facts where they apply. The result is short, info-dense,
 * accurate copy without needing a full Swedish-to-Ukrainian translator.
 *
 * Usage:
 *   node scripts/do88/generate-specs.mjs
 *
 * Output: scripts/do88/scraped/do88-specs.generated.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPED_FILE = path.join(__dirname, 'scraped', 'do88-pages.json');
const OUTPUT_FILE = path.join(__dirname, 'scraped', 'do88-specs.generated.ts');

// ────────────────────────────────────────────────────────────────────────────
// Fact extractors — pull numeric data out of Swedish bullet lines.
// ────────────────────────────────────────────────────────────────────────────

function extractTempDelta(text) {
  // "12°C lägre" or "12 °C lägre" → 12
  const m = text.match(/(\d{1,2})\s*°\s*C\s*l[äa]gre/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractTempReadings(text) {
  // "36°C (48°C)" — current vs OE
  const m = text.match(/(\d{2})\s*°\s*C\s*\(\s*(\d{2})\s*°\s*C\s*\)/);
  if (m) return { current: parseInt(m[1], 10), oe: parseInt(m[2], 10) };
  return null;
}

function extractCfm(text) {
  // "799 CFM (740 CFM), 8% högre" or "799 CFM (+8%)"
  const cfmMatch = text.match(/(\d{2,4})\s*CFM\s*\(\s*(\d{2,4})\s*CFM\s*\)\s*,?\s*(\d{1,3})\s*%/i)
    || text.match(/(\d{2,4})\s*CFM[^.]*?\(\s*\+?(\d{1,3})\s*%/i);
  if (cfmMatch && cfmMatch.length >= 4) {
    return { current: parseInt(cfmMatch[1], 10), oe: parseInt(cfmMatch[2], 10), gainPct: parseInt(cfmMatch[3], 10) };
  }
  return null;
}

function extractPressureDrop(text) {
  // "0,125 bar / 1,81 psi"
  const m = text.match(/(\d+[,.]\d+)\s*bar\s*\/\s*(\d+[,.]\d+)\s*psi/i);
  if (m) return { bar: m[1].replace(',', '.'), psi: m[2].replace(',', '.') };
  return null;
}

function extractCoreThickness(text) {
  // "105 mm i tjocklek" or "tjocklek: 105 mm"
  const m = text.match(/(\d{2,3})\s*mm[^.]*tjocklek/i)
    || text.match(/tjocklek[^.]{0,20}(\d{2,3})\s*mm/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractMethanolPorts(text) {
  return /metanolinsprutning|methanol/i.test(text);
}

function extractCarbon(text) {
  return /kolfiber|carbon[\s-]?fib|prepreg/i.test(text);
}

function extractGarrettBarPlate(text) {
  return /Bar\s*&?\s*Plate/i.test(text) || /Garrett\s*Motorsport/i.test(text);
}

function extractBackgroundFacts(allText) {
  const facts = {};
  for (const line of allText) {
    if (!facts.tempDelta) facts.tempDelta = extractTempDelta(line);
    if (!facts.tempReadings) facts.tempReadings = extractTempReadings(line);
    if (!facts.cfm) facts.cfm = extractCfm(line);
    if (!facts.pressureDrop) facts.pressureDrop = extractPressureDrop(line);
    if (!facts.coreThickness) facts.coreThickness = extractCoreThickness(line);
    if (facts.methanol === undefined && extractMethanolPorts(line)) facts.methanol = true;
    if (facts.carbon === undefined && extractCarbon(line)) facts.carbon = true;
    if (facts.barPlateGarrett === undefined && extractGarrettBarPlate(line)) facts.barPlateGarrett = true;
  }
  return facts;
}

// ────────────────────────────────────────────────────────────────────────────
// Kind detection based on title/URL
// ────────────────────────────────────────────────────────────────────────────

function detectKind(title, url) {
  const text = `${title || ''} ${url || ''}`.toLowerCase();
  if (/big[-\s]?pack|bigpack/.test(text)) return 'big-pack';
  if (/intercooler|laddluftkylare|laddluftk/.test(text)) return 'intercooler';
  if (/oljekyl|oil[-\s]?cool/.test(text)) return 'oil-cooler';
  if (/intag|insug|intake/.test(text)) return 'intake';
  if (/y[-\s]?r[oö]r|y[-\s]?pipe/.test(text)) return 'y-pipe';
  if (/plenum/.test(text)) return 'plenum';
  if (/charge\s*pipe|tryckr[oö]r|laddtryck/.test(text)) return 'charge-pipe';
  if (/kolfiber|carbon/.test(text)) return 'carbon-cover';
  if (/luftfilter|air[-\s]?filter/.test(text)) return 'air-filter';
  if (/vattenkyl/.test(text)) return 'radiator';
  if (/slangkit|hose[-\s]?kit|kylarslang/.test(text)) return 'hose-kit';
  return 'unknown';
}

// ────────────────────────────────────────────────────────────────────────────
// Fitment detection — extract clean chassis label from title
// ────────────────────────────────────────────────────────────────────────────

function detectFitment(title) {
  const t = String(title || '');

  // Porsche
  if (/porsche/i.test(t)) {
    const m = t.match(/\((9(?:30|64|93|96|97|91|92)(?:\.\d)?)\)/) || t.match(/\b(9(?:30|64|93|96|97|91|92)(?:\.\d)?)\b/);
    if (m) {
      const variant = /turbo/i.test(t) ? ' Turbo' : /carrera/i.test(t) ? ' Carrera' : /gt2/i.test(t) ? ' GT2' : /gt3/i.test(t) ? ' GT3' : '';
      return `Porsche 911${variant} (${m[1]})`;
    }
    if (/cayman|boxster/i.test(t)) return 'Porsche Cayman / Boxster';
  }

  // BMW M-series with G/F chassis
  const bmwM = t.match(/BMW[\s,]*M[234]?(?:[\s/,]*M[234])*[\s,]*(?:\(?([GF]8[027])(?:[/,\s]*([GF]8[027]))*\)?|[GF]8[027])/i);
  if (bmwM) {
    const codes = [];
    const all = t.match(/[GF]8[027]/gi) || [];
    all.forEach((c) => { if (!codes.includes(c.toUpperCase())) codes.push(c.toUpperCase()); });
    return `BMW M2/M3/M4 (${codes.join('/')})`;
  }

  // BMW G2x with B58
  const bmwG = t.match(/BMW[^.]*\b(G[12]0|G[12]2|G29)\b/i);
  if (bmwG) return `BMW (${bmwG[1].toUpperCase()}, B58)`;

  // BMW Front intercooler etc — no clear chassis
  if (/F8X|F[8]\d/i.test(t)) return 'BMW F8X (M2/M3/M4)';

  // Audi
  if (/audi[^a-z]*rs[67]/i.test(t)) return 'Audi RS6 / RS7 (C8, 4.0 TFSI V8)';
  if (/(rs3|tt[\s-]?rs)/i.test(t)) return 'Audi RS3 / TT RS (8V/8Y/8S, 2.5 TFSI)';
  if (/audi[^a-z]*(?:a3|s3).*(8v|8y)/i.test(t)) return 'Audi A3 / S3 (8V/8Y)';
  if (/golf[^a-z]*r/i.test(t) && /mk[78]/i.test(t)) {
    const m = t.match(/mk[78](?:\.5)?/i);
    return `VW Golf R (${m ? m[0].toUpperCase() : 'Mk7/Mk8'})`;
  }
  if (/golf[^a-z]*(gti|r)/i.test(t)) return 'VW Golf GTI / R';

  // Toyota
  if (/supra[^a-z]*a90/i.test(t)) return 'Toyota GR Supra (A90, B58)';
  if (/yaris/i.test(t)) return 'Toyota GR Yaris';

  // Volvo / Saab — keep but won't actually be displayed (filtered out elsewhere)
  if (/volvo/i.test(t)) {
    const m = t.match(/(240|740|850|940|s60|v60|v70|s70|xc60|xc70|xc90)\s*([A-Z0-9]+)?/i);
    if (m) return `Volvo ${m[1].toUpperCase()}`;
    return 'Volvo';
  }
  if (/saab/i.test(t)) {
    const m = t.match(/(9-3|9-5|9000|900)/i);
    if (m) return `Saab ${m[1]}`;
    return 'Saab';
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Build per-SKU spec entry from scraped data + facts
// ────────────────────────────────────────────────────────────────────────────

function buildSpecEntry(sku, page) {
  const kind = detectKind(page.title, page.url);
  const fitment = detectFitment(page.title);
  const facts = extractBackgroundFacts([
    ...(page.description || []),
    ...(page.keyFeatures || []),
  ]);

  // Build sections — only include those that have facts/content
  const sections = [];

  // Performance section (only if we have measured data)
  const perfBulletsUa = [];
  const perfBulletsEn = [];
  if (facts.tempReadings) {
    const { current, oe } = facts.tempReadings;
    const delta = oe - current;
    perfBulletsUa.push(`Температура наддуву: ${current} °C проти ${oe} °C OE — на ${delta} °C нижче`);
    perfBulletsEn.push(`Intake temperature: ${current} °C vs ${oe} °C OE — ${delta} °C lower`);
  } else if (facts.tempDelta) {
    perfBulletsUa.push(`Температура наддуву на ${facts.tempDelta} °C нижча vs OE`);
    perfBulletsEn.push(`Intake temperature ${facts.tempDelta} °C lower vs OE`);
  }
  if (facts.cfm) {
    const { current, oe, gainPct } = facts.cfm;
    const drop = facts.pressureDrop;
    const dropTxt = drop ? ` при ${drop.bar.replace('.', ',')} bar / ${drop.psi.replace('.', ',')} psi падіння` : '';
    const dropEn = drop ? ` at ${drop.bar} bar / ${drop.psi} psi drop` : '';
    if (oe) {
      perfBulletsUa.push(`Повітряний потік: ${current} CFM${dropTxt} — +${gainPct}% vs OE ${oe} CFM`);
      perfBulletsEn.push(`Airflow: ${current} CFM${dropEn} — +${gainPct}% vs OE ${oe} CFM`);
    } else {
      perfBulletsUa.push(`Повітряний потік: ${current} CFM${dropTxt} (+${gainPct}% vs OE)`);
      perfBulletsEn.push(`Airflow: ${current} CFM${dropEn} (+${gainPct}% vs OE)`);
    }
  }
  if (perfBulletsUa.length > 0) {
    sections.push({
      kicker: { ua: 'Продуктивність', en: 'Performance' },
      bullets: { ua: perfBulletsUa, en: perfBulletsEn },
    });
  }

  // Construction section
  const conBulletsUa = [];
  const conBulletsEn = [];
  if (facts.barPlateGarrett) {
    if (facts.coreThickness) {
      conBulletsUa.push(`Bar & Plate осердя Garrett Motorsport, товщина ${facts.coreThickness} мм`);
      conBulletsEn.push(`Garrett Motorsport Bar & Plate core, ${facts.coreThickness} mm thick`);
    } else {
      conBulletsUa.push('Bar & Plate осердя Garrett Motorsport');
      conBulletsEn.push('Garrett Motorsport Bar & Plate core');
    }
  } else if (facts.coreThickness) {
    conBulletsUa.push(`Товщина осердя ${facts.coreThickness} мм`);
    conBulletsEn.push(`${facts.coreThickness} mm core thickness`);
  }
  if (kind === 'intercooler' || kind === 'big-pack') {
    conBulletsUa.push('Литі алюмінієві бачки CAD-розробки для оптимальних потоків');
    conBulletsEn.push('CAD-designed cast aluminium tanks for optimised flow');
  }
  if (facts.carbon) {
    conBulletsUa.push('Карбонові повітроводи з prepreg-карбону');
    conBulletsEn.push('Pre-preg carbon-fibre airflow guides');
  }
  if (facts.methanol) {
    conBulletsUa.push('Порти для методанолового впорскування');
    conBulletsEn.push('Methanol injection ports');
  }
  if (kind === 'hose-kit') {
    conBulletsUa.push('Армований 4-шаровий силікон, витримує підвищений тиск і температуру');
    conBulletsEn.push('4-ply reinforced silicone, withstands elevated pressure and temperature');
  }
  if (conBulletsUa.length > 0) {
    sections.push({
      kicker: { ua: 'Конструкція', en: 'Construction' },
      bullets: { ua: conBulletsUa, en: conBulletsEn },
    });
  }

  if (sections.length === 0 && (!page.oeRefs || page.oeRefs.length === 0)) {
    // Nothing useful extracted — skip this entry, fallback enricher will handle it
    return null;
  }

  // Headline depends on kind + facts
  let headlineUa, headlineEn;
  switch (kind) {
    case 'intercooler':
    case 'big-pack': {
      const claims = [];
      const claimsEn = [];
      if (facts.tempDelta) {
        claims.push(`знижує температуру наддуву на ${facts.tempDelta} °C`);
        claimsEn.push(`drops intake temperature by ${facts.tempDelta} °C`);
      } else if (facts.tempReadings) {
        const d = facts.tempReadings.oe - facts.tempReadings.current;
        claims.push(`знижує температуру наддуву на ${d} °C`);
        claimsEn.push(`drops intake temperature by ${d} °C`);
      }
      if (facts.cfm) {
        claims.push(`+${facts.cfm.gainPct}% повітряного потоку проти OE`);
        claimsEn.push(`+${facts.cfm.gainPct}% airflow vs OE`);
      }
      const claimUa = claims.length > 0 ? `. ${claims.join(', ')}.` : '.';
      const claimEn = claimsEn.length > 0 ? `. ${claimsEn.join(', ')}.` : '.';
      const productLabel = kind === 'big-pack' ? 'Big Pack — комплектний апгрейд do88' : 'Інтеркулерний комплект do88';
      const productLabelEn = kind === 'big-pack' ? 'Big Pack — complete do88 upgrade' : 'do88 intercooler kit';
      headlineUa = fitment ? `${productLabel} для ${fitment}${claimUa}` : `${productLabel}${claimUa}`;
      headlineEn = fitment ? `${productLabelEn} for ${fitment}${claimEn}` : `${productLabelEn}${claimEn}`;
      break;
    }
    case 'intake': {
      headlineUa = fitment ? `Впускна система do88 для ${fitment}. Чистіший потік повітря, ізоляція від тепла моторного відсіку.` : 'Впускна система do88. Чистіший потік повітря, ізоляція від тепла моторного відсіку.';
      headlineEn = fitment ? `do88 intake system for ${fitment}. Cleaner airflow, engine-bay heat isolation.` : 'do88 intake system. Cleaner airflow, engine-bay heat isolation.';
      break;
    }
    case 'plenum':
      headlineUa = fitment ? `Пленум впуску do88 для ${fitment}. Збільшений обʼєм для рівномірного розподілу повітря.` : 'Пленум впуску do88. Збільшений обʼєм для рівномірного розподілу повітря.';
      headlineEn = fitment ? `do88 intake plenum for ${fitment}. Increased volume for even air distribution.` : 'do88 intake plenum. Increased volume for even air distribution.';
      break;
    case 'y-pipe':
      headlineUa = fitment ? `Y-труба наддуву do88 для ${fitment}. Точна геометрія потоку, drop-in заміна OE.` : 'Y-труба наддуву do88. Точна геометрія потоку, drop-in заміна OE.';
      headlineEn = fitment ? `do88 charge-air Y-pipe for ${fitment}. Precise flow geometry, drop-in OE replacement.` : 'do88 charge-air Y-pipe. Precise flow geometry, drop-in OE replacement.';
      break;
    case 'charge-pipe':
      headlineUa = fitment ? `Алюмінієвий пайп наддуву do88 для ${fitment}. Заміна пластикового OE-елемента.` : 'Алюмінієвий пайп наддуву do88. Заміна пластикового OE-елемента.';
      headlineEn = fitment ? `do88 aluminium charge pipe for ${fitment}. Replaces failure-prone plastic OE part.` : 'do88 aluminium charge pipe. Replaces failure-prone plastic OE part.';
      break;
    case 'oil-cooler':
      headlineUa = fitment ? `Масляний радіатор do88 для ${fitment}. Збільшена поверхня теплообміну.` : 'Масляний радіатор do88. Збільшена поверхня теплообміну.';
      headlineEn = fitment ? `do88 oil cooler for ${fitment}. Increased heat-exchange surface.` : 'do88 oil cooler. Increased heat-exchange surface.';
      break;
    case 'radiator':
      headlineUa = fitment ? `Радіатор do88 підвищеної продуктивності для ${fitment}.` : 'Радіатор do88 підвищеної продуктивності.';
      headlineEn = fitment ? `do88 high-performance radiator for ${fitment}.` : 'do88 high-performance radiator.';
      break;
    case 'hose-kit':
      headlineUa = fitment ? `Силіконовий патрубковий комплект do88 для ${fitment}.` : 'Силіконовий патрубковий комплект do88.';
      headlineEn = fitment ? `do88 silicone hose kit for ${fitment}.` : 'do88 silicone hose kit.';
      break;
    case 'carbon-cover':
      headlineUa = fitment ? `Карбонові кришки моторного відсіку do88 для ${fitment}.` : 'Карбонові кришки моторного відсіку do88.';
      headlineEn = fitment ? `do88 carbon engine bay covers for ${fitment}.` : 'do88 carbon engine bay covers.';
      break;
    default:
      return null;
  }

  return {
    sku,
    headline: { ua: headlineUa, en: headlineEn },
    fitment: fitment ? { ua: fitment, en: fitment } : null,
    sections,
    replacesOe: page.oeRefs && page.oeRefs.length > 0 ? page.oeRefs.slice(0, 8) : null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Code generation
// ────────────────────────────────────────────────────────────────────────────

function tsString(s) {
  if (s === null || s === undefined) return 'undefined';
  return JSON.stringify(s);
}

function emitEntry(e) {
  const validSections = (e.sections || []).filter((s) => s && s.bullets && (s.bullets.ua?.length || s.bullets.en?.length));
  const sectionsCode = validSections.length === 0
    ? ''
    : validSections.map((s) => {
        const kicker = s.kicker
          ? `      kicker: { ua: ${tsString(s.kicker.ua)}, en: ${tsString(s.kicker.en)} },\n`
          : '';
        const bulletsUa = s.bullets.ua.map((b) => `          ${tsString(b)}`).join(',\n');
        const bulletsEn = s.bullets.en.map((b) => `          ${tsString(b)}`).join(',\n');
        return `    {\n${kicker}      bullets: {\n        ua: [\n${bulletsUa},\n        ],\n        en: [\n${bulletsEn},\n        ],\n      },\n    }`;
      }).join(',\n');

  const fitmentBlock = e.fitment
    ? `  fitment: { ua: ${tsString(e.fitment.ua)}, en: ${tsString(e.fitment.en)} },\n`
    : '';
  const oeBlock = e.replacesOe
    ? `  replacesOe: ${JSON.stringify(e.replacesOe)},\n`
    : '';

  const sectionsBlock = sectionsCode
    ? `  sections: [\n${sectionsCode},\n  ],\n`
    : `  sections: [],\n`;

  return `'${e.sku}': {\n  headline: {\n    ua: ${tsString(e.headline.ua)},\n    en: ${tsString(e.headline.en)},\n  },\n${fitmentBlock}${sectionsBlock}${oeBlock}},`;
}

async function main() {
  const scrapedRaw = await fs.readFile(SCRAPED_FILE, 'utf-8');
  const scraped = JSON.parse(scrapedRaw);

  // Fetch our DB SKUs
  const productsRes = await fetch('http://localhost:3000/api/shop/products');
  const products = await productsRes.json();
  const do88 = products.filter((p) => (p.brand || '').toLowerCase() === 'do88');
  const dbSkus = new Set(do88.map((p) => (p.sku || '').toUpperCase()).filter(Boolean));

  console.log(`[input] scraped ${Object.keys(scraped.bySku).length} pages; DB has ${dbSkus.size} DO88 SKUs`);

  const entries = [];
  let kindCounts = {};
  let skipped = 0;
  for (const [sku, page] of Object.entries(scraped.bySku)) {
    if (!dbSkus.has(sku)) continue;
    const entry = buildSpecEntry(sku, page);
    if (!entry) {
      skipped++;
      continue;
    }
    entries.push(entry);
    const kind = detectKind(page.title, page.url);
    kindCounts[kind] = (kindCounts[kind] || 0) + 1;
  }

  entries.sort((a, b) => a.sku.localeCompare(b.sku));
  console.log(`[generate] produced ${entries.length} entries (skipped ${skipped} for lack of facts)`);
  console.log('[breakdown]', kindCounts);

  const body = entries.map(emitEntry).join('\n  ');
  const fileContent = `// Generated by scripts/do88/generate-specs.mjs
// Do not edit by hand — run the generator after re-scraping do88.se.
// Last generated: ${new Date().toISOString()}

import type { Do88ProductSpec } from '@/lib/do88ProductSpecs';

export const DO88_GENERATED_SPECS: Record<string, Do88ProductSpec> = {
  ${body}
};
`;

  await fs.writeFile(OUTPUT_FILE, fileContent, 'utf-8');
  console.log(`[done] wrote ${OUTPUT_FILE} (${entries.length} entries)`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
