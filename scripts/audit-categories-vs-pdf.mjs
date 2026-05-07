#!/usr/bin/env node
/**
 * Cross-check categoryData.ts against the PDF "OneCompany Brand Portfolio 2026 EN".
 *
 * Rule (per Ivan, 2026-05-07):
 *   - Brand IS in PDF  → must live in the PDF-mandated category on the site.
 *                          If it's elsewhere on the site, that's a mismatch to fix.
 *   - Brand NOT in PDF → leave it where it is (site catalog is intentionally wider).
 *
 * The PDF has separate COOLING and TIRES; the site has a combined `cooling` slug
 * — both are accepted as the destination for those PDF brands.
 *
 * Output: brand-by-brand verdict with the PDF category, the site slug(s) where
 * we currently list the brand, and a flag for "missing on site" / "wrong slug".
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// PDF brand data — extracted from OneCompany_Brand_Portfolio_2026_EN.pdf
// Keys are PDF category names. Values are arrays of brand names as they
// appear in the PDF.
const PDF = {
  WHEELS: [
    '1221 Wheels', 'ADV.1 Wheels', 'AL13 Wheels', 'ANRKY Wheels',
    'Avant Garde Wheels', 'Brixton Wheels', 'HRE Wheels', 'MV Forged',
    'ONE COMPANY forged', 'Project 6GR', 'ProTrack Wheels', 'Raliw Forged',
    'Strasse Wheels', 'Velos Designwerks', 'WheelForce',
  ],
  BODY_KITS: [
    'ADRO', 'Alpha-N', 'APR Performance', 'CT Carbon', 'DMC', 'Karbonius',
    'KeyVany', 'Larte Design', 'Liberty Walk', 'Lingenfelter', 'Matts Performance',
    'Paktechz', 'Renegade Design', 'Ronin Design', 'RYFT', 'SCL Concept',
    'SooQoo', 'Sterckenn', 'TopCar Design', 'Urban Automotive', 'Verus Engineering', 'Zacoe',
  ],
  OEM_PARTS: ['Aston Martin', 'Ferrari', 'Lamborghini', 'Maserati', 'McLaren', 'Rolls Royce'],
  EXHAUST_SYSTEMS: [
    'Akrapovic', 'American Racing Headers', 'Armytrix', 'Borla', 'Capristo',
    'Fabspeed', 'FI Exhaust', 'GTHaus', 'iPE Exhaust', 'Kline Innovation',
    'Kooks Headers', 'Milltek', 'Red Star Exhaust', 'Remus', 'RES Exhaust',
    'Supersprint', 'Tubi Style',
  ],
  ENGINE_TUNING: [
    '5150 Autosport', 'ARE Dry Sump', 'BE Bearings', 'Big Boost', 'Black Boost',
    'BMC Filters', 'Cobb tuning', 'Deatschwerks', 'Dorch Engineering', 'ESS Tuning',
    'Eventuri', 'Fore Innovations', 'Fragola Performance Systems', 'Full-Race',
    'Gruppe-M', 'Harrop', 'Injector Dynamics', 'ItalianRP', 'Killer B Motorsport',
    'KLM Race', 'Lingenfelter', 'LOBA Motorsport', 'Mamba Turbo', 'Motiv Motorsport',
    'MST Performance', 'Power Division', 'Premier Tuning Group', 'Pulsar Turbo',
    'Pure Turbos', 'RK Autowerks', 'Schrick', 'Silly Rabbit Motorsport',
    'Spool Performance', 'Titan Motorsport', 'TTE Turbos', 'TTH Turbos',
    'Vargas Turbo', 'VF Engineering', 'Weistec Engineering', 'XDI Fuel Systems',
  ],
  SUSPENSION_BRAKES: [
    'Airlift Performance', 'BC Racing', 'Brembo', 'Fall-Line', 'Girodisc',
    'Hardrace', 'KW Suspension', 'MCA Suspension', 'Nitron Suspension',
    'Paragon Brakes', 'RS-R', 'SPL Parts', 'STOPART Ceramic', 'STOPFLEX', 'Stoptech',
  ],
  TRANSMISSION: [
    'Circle D', 'Drenth Gearboxes', 'Driveshaftshop', 'JXB Performance', 'Kotouc',
    'Modena Engineering', 'Moser Engineering', 'Paramount Transmissions',
    'Pure Drivetrain Solutions', 'RPM Transmissions', 'Sachs Performance',
    'Samsonas Motorsport', 'ShepTrans', 'Southern Hotrod', 'Wavetrac', 'Xshift',
  ],
  TIRES: [
    'Continental', 'Extreme tyres', 'Falken', 'Hoosier', 'Maxxis', 'Michelin',
    'Mickey Thompson', 'Nitto', 'Pirelli', 'Toyo Tires', 'Yokohama',
  ],
  COOLING: [
    'Bell Intercoolers', 'CSF', 'do88', 'Mishimoto', 'Samco Sport',
    'Verus Engineering', 'Wagner Tuning',
  ],
  COMPREHENSIVE_TUNING: [
    'ABT', 'AC Schnitzer', 'AMS / Alpha Performance', 'BBi Autosport', 'BimmerWorld',
    'Brabus', 'Dahler', 'Dinan', 'Hamann', 'Heico', 'KAHN design', 'Lamspeed',
    'Lorinser', 'Lumma', 'Manhart', 'Mansory', 'Mountune', 'Novitec', 'Onyx Concept',
    'R44 Performance', 'Renntech', 'Stillen', 'Techart', 'Turner Motorsport',
  ],
  ELECTRONICS_CHIP_TUNING: [
    'AIM Sportline', 'BootMod3', 'Burger Motorsports', 'DTE Systems',
    'Link ECU', 'Lithiumax',
  ],
};

// Moto PDF — note PDF has several typos vs the brands' canonical spellings;
// the audit normalizer ignores most punctuation/spacing differences but the
// dropped/added letters below need explicit aliasing in normalize().
const PDF_MOTO = {
  ELECTRONICS_DEVICES: [
    'AIM Tech', 'BT Moto', 'Cordona', 'ECUStudio', 'FlashTune',
    'Healtech', 'HM Quickshifter', 'JetPrime', 'Starlane', 'Translogic',
  ],
  EXHAUST_BRAKES: [
    'Accossato', 'Akrapovic', 'Arrow', 'Austin Racing', 'Brembo',
    'Cobra Sport', 'Dominator Exhaust', 'IXIL', 'SC-Project', 'SparkExhaust',
    'Termignoni', 'TOCE Exhaust', 'Vandemon', 'ZARD Exhaust',
  ],
  COMPREHENSIVE_TUNING_OEM: ['Alpha Racing', 'Evolution Bike'],
  SUSPENSION_SHOCK: ['Bitubo', 'GPR Stabilizer', 'HyperPro', 'Ohlins'],
  WHEELS_TIRES_EQUIPMENT: [
    'Capit', 'Marchesini', 'OZ Racing', 'Racefoxx', 'Rotobox',
    'Thermal Technology', 'ValterMoto', 'X-GRIP',
  ],
  TRANSMISSION_GEARBOX: ['Ceracarbon', 'EVR', 'STM Italy', 'TSS'],
  ACCESSORIES_MILLING: [
    'AEM Factory', 'ARP Racingparts', 'Bonamici', 'CNC Racing', 'DB-Race',
    'Domino', 'Evotech', 'GBracing', 'Gilles Tooling', 'Melotti Racing',
    'New Rage Cycles', 'R&G Racing', 'Rizoma', 'Stompgrip', 'TWM',
  ],
  CARBON_PLASTIC: ['Bikesplast', 'Fullsix Carbon', 'Ilmberger Carbon', 'S2 Concept', 'Sebimoto'],
  ENGINE_FUEL_COOLING: ['AXP', 'Febur', 'Samco Sport', 'Sprint Filter'],
};

const MOTO_PDF_TO_SLUGS = {
  ELECTRONICS_DEVICES: ['moto-electronics'],
  EXHAUST_BRAKES: ['moto-exhaust', 'moto-wheels', 'moto-controls'], // PDF combines exhaust+brakes; we split brakes (in moto-wheels for radial cylinders, moto-controls for levers)
  COMPREHENSIVE_TUNING_OEM: ['moto-electronics'],
  SUSPENSION_SHOCK: ['moto-suspension'],
  WHEELS_TIRES_EQUIPMENT: ['moto-wheels', 'moto-suspension', 'moto-controls'],
  TRANSMISSION_GEARBOX: ['moto-electronics', 'moto-controls'], // we don't have a dedicated moto drivetrain slug
  ACCESSORIES_MILLING: ['moto-controls', 'moto-carbon'],
  CARBON_PLASTIC: ['moto-carbon'],
  ENGINE_FUEL_COOLING: ['moto-suspension', 'moto-electronics'], // we don't have moto-cooling
};

// PDF category → list of acceptable site slugs.
// Multiple slugs are accepted when the site combines or splits relative to the PDF.
const PDF_TO_SLUGS = {
  WHEELS: ['wheels'],
  BODY_KITS: ['exterior'],
  OEM_PARTS: ['oem'],
  EXHAUST_SYSTEMS: ['exhaust'],
  ENGINE_TUNING: ['performance', 'intake'], // intake = subset of engine
  SUSPENSION_BRAKES: ['suspension'],
  TRANSMISSION: ['drivetrain'],
  TIRES: ['cooling'], // site combines
  COOLING: ['cooling'],
  COMPREHENSIVE_TUNING: ['electronics', 'exterior'], // we don't have a dedicated slug yet; comprehensive tuners live in either
  ELECTRONICS_CHIP_TUNING: ['electronics'],
};

function loadCategoryData(targetSegment = 'auto') {
  const src = readFileSync(join(ROOT, 'src/lib/categoryData.ts'), 'utf8');
  const brandsByCategory = {};
  const blockRe = /slug:\s*['"]([\w-]+)['"][\s\S]*?segment:\s*['"](auto|moto)['"][\s\S]*?brands:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = blockRe.exec(src))) {
    const slug = m[1];
    const segment = m[2];
    if (segment !== targetSegment) continue;
    const arr = m[3];
    // Per-line parser — handles entries with apostrophes (e.g. "Matt's carbon").
    // Each brand sits on its own line as `   'Name',` or `   "Name",`.
    const names = [];
    for (const rawLine of arr.split(/\r?\n/)) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line) continue;
      const sq = line.match(/^'([^']*(?:\\'[^']*)*)',?$/);
      const dq = line.match(/^"([^"]*(?:\\"[^"]*)*)",?$/);
      const name = sq ? sq[1] : dq ? dq[1] : null;
      if (name) names.push(name);
    }
    brandsByCategory[slug] = names;
  }
  return brandsByCategory;
}

const segment = process.argv.includes('--moto') ? 'moto' : 'auto';
const PDF_DATA = segment === 'moto' ? PDF_MOTO : PDF;
const SLUGS_MAP = segment === 'moto' ? MOTO_PDF_TO_SLUGS : PDF_TO_SLUGS;
const slugBrands = loadCategoryData(segment);
const brandToSlugs = {};
for (const [slug, brands] of Object.entries(slugBrands)) {
  for (const b of brands) {
    const key = normalize(b);
    brandToSlugs[key] ??= [];
    brandToSlugs[key].push({ slug, displayName: b });
  }
}

function normalize(s) {
  let v = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^the/, '');
  // Strip generic trailing qualifiers so PDF-and-site variants of the same
  // brand match: "APR Performance" ↔ "APR", "Paktechz Design" ↔ "Paktechz",
  // "Fall-Line Motorsports" ↔ "Fall-Line", "Extreme Performance Tyres"
  // ↔ "Extreme Tyres". Order matters — strip from the end iteratively.
  let prev;
  do {
    prev = v;
    v = v
      .replace(/(performance|motorsports?|design|carbon|engineering|tyres?|tires?|forged|wheels?|company)$/, '')
      .replace(/^(the)/, '');
  } while (v !== prev && v.length > 2);
  return v;
}

const reportLines = [];
const issues = { missingOnSite: [], wrongSlug: [], ok: [] };
for (const [pdfCat, brands] of Object.entries(PDF_DATA)) {
  const acceptable = SLUGS_MAP[pdfCat] || [];
  for (const pdfName of brands) {
    const key = normalize(pdfName);
    const presence = brandToSlugs[key] || [];
    if (presence.length === 0) {
      issues.missingOnSite.push({ pdfCat, pdfName });
      continue;
    }
    const onSlugs = presence.map((p) => p.slug);
    const hasAcceptable = onSlugs.some((s) => acceptable.includes(s));
    const extraSlugs = onSlugs.filter((s) => !acceptable.includes(s));
    if (hasAcceptable && extraSlugs.length === 0) {
      issues.ok.push({ pdfCat, pdfName, onSlugs });
    } else if (hasAcceptable && extraSlugs.length > 0) {
      issues.wrongSlug.push({
        pdfCat, pdfName, expected: acceptable, onSlugs,
        extraSlugs,
        status: 'present-correctly-but-also-wrong-slugs',
      });
    } else {
      issues.wrongSlug.push({
        pdfCat, pdfName, expected: acceptable, onSlugs,
        status: 'present-only-in-wrong-slugs',
      });
    }
  }
}

console.log(`\n=== PDF cross-check (${segment}) ===`);
console.log(`PDF brands: ${Object.values(PDF_DATA).flat().length}`);
console.log(`OK: ${issues.ok.length}   wrong-slug: ${issues.wrongSlug.length}   missing on site: ${issues.missingOnSite.length}\n`);

if (issues.wrongSlug.length > 0) {
  console.log('-- Brands in WRONG site slug (PDF says one place, we have it elsewhere) --');
  for (const w of issues.wrongSlug) {
    const verb = w.status === 'present-only-in-wrong-slugs' ? '✗ ONLY in' : '⚠ also in';
    console.log(`  [${w.pdfCat}] ${w.pdfName}: PDF→${w.expected.join(',')}, ${verb} ${w.onSlugs.join(',')}`);
  }
  console.log('');
}

if (issues.missingOnSite.length > 0) {
  console.log('-- PDF brands not present in any auto category on the site --');
  for (const m of issues.missingOnSite) {
    console.log(`  [${m.pdfCat}] ${m.pdfName}`);
  }
  console.log('');
}

// Also report site brands per slug that are not in any PDF auto category — these
// are site-extras we should NOT touch per Ivan's rule.
const allPdfNames = new Set(Object.values(PDF_DATA).flat().map(normalize));
const siteOnly = [];
for (const [slug, brands] of Object.entries(slugBrands)) {
  for (const b of brands) {
    const key = normalize(b);
    if (!allPdfNames.has(key)) {
      siteOnly.push({ slug, name: b });
    }
  }
}
console.log(`-- Site-only ${segment} brands (NOT in PDF — per rule, leave alone) — ${siteOnly.length} --`);
for (const s of siteOnly.slice(0, 100)) {
  console.log(`  [${s.slug}] ${s.name}`);
}
if (siteOnly.length > 100) console.log(`  ... and ${siteOnly.length - 100} more`);
