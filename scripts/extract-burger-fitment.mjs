// Burger Motorsports fitment extractor
// Parses chassis codes, engine codes, models, year ranges from descriptionEn
// Adds chassis:*, engine:*, model:*, year:* tags
// Input:  data/burger-products.json
// Output: data/burger-products-with-fitment.json + summary report

import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'data', 'burger-products.json');
const OUT = path.join(process.cwd(), 'data', 'burger-products-with-fitment.json');

// ───────────────────────────── BMW ─────────────────────────────
// Chassis codes: letter (E/F/G/U/I) + 2 digits, e.g. F30, G20, U06, I20
const BMW_CHASSIS_RX = /\b([EFG]\d{2}|U\d{2}|I\d{2})\b/g;
// Whitelist of REAL BMW chassis codes (excludes Mini F54-F60, Infiniti G35/G37/I35,
// fuel-ethanol "E10", and other non-existent codes)
const BMW_CHASSIS_WHITELIST = new Set([
  // E-Series
  'E12','E21','E23','E24','E26','E28','E30','E31','E32','E34','E36','E38','E39',
  'E46','E52','E53','E60','E61','E63','E64','E65','E66','E70','E71','E72',
  'E81','E82','E83','E84','E85','E86','E87','E88','E89','E90','E91','E92','E93',
  // F-Series (excludes Mini F54-F60)
  'F01','F02','F03','F04','F06','F07','F10','F11','F12','F13','F15','F16','F18',
  'F20','F21','F22','F23','F25','F26','F30','F31','F32','F33','F34','F35','F36',
  'F39','F40','F44','F45','F46','F48','F49','F52',
  'F80','F82','F83','F85','F86','F87','F90','F91','F92','F93','F95','F96','F97','F98',
  // G-Series (excludes Infiniti G35/G37)
  'G01','G02','G05','G06','G07','G08','G09','G11','G12','G14','G15','G16','G18',
  'G20','G21','G22','G23','G26','G28','G29','G30','G31','G32','G38',
  'G42','G45','G60','G61','G68','G70','G80','G81','G82','G83','G87','G90','G99',
  // U-Series (2-Series Active Tourer 2022+)
  'U06','U10','U11','U12','U25',
  // I-Series (electric)
  'I01','I12','I15','I20','I22',
]);
const BMW_CHASSIS_VALID = /^([EFG]\d{2}|U\d{2}|I\d{2})$/;
// E85 is also "ethanol fuel" — only treat as Z4 chassis when in BMW vehicle context
const E85_FUEL_CONTEXT = /\bE85\s*(fuel|ethanol|gas|gasoline|blend|content|mix|injector|pump|capable|compatible|sensor|kit|analyzer)\b|\b(running|run|burn|use|using)\s+E85\b|\bethanol[^.]{0,50}E85\b/i;
// Common BMW engines (N-series, S-series, B-series)
const BMW_ENGINE_RX = /\b(N20|N26|N51|N52|N53|N54|N55|N57|N63|N73|N74|S14|S38|S50|S52|S54|S55|S58|S62|S63|S65|S68|S85|B38|B46|B48|B57|B58|M50|M52|M54|M62)\b/gi;
// Models — simpler text patterns
const BMW_MODEL_RX = /\bBMW\s+([1-9]\s?Series|X[1-7]M?|Z[1-9]|M[1-9]|i[34578]|iX[1-3]?)\b/gi;

// ─────────────────────────── Toyota ────────────────────────────
const TOYOTA_CHASSIS_RX = /\b(GR\s?Supra|MK[3-5]|A90|A91|J29)\b/gi;
const TOYOTA_ENGINE_RX = /\b(B58|2JZ|1JZ|1UR|2UR|V35A|T24A)\b/gi;
const TOYOTA_MODEL_RX = /\b(Supra|GR\s?Corolla|GR\s?Yaris|GR\s?86|Tundra|Sequoia|Tacoma|4Runner|Camry|Highlander|RAV4|Land\s?Cruiser|LC500|LC300|Prius|Crown|Avalon)\b/gi;

// ────────────────────────── Hyundai/Kia ────────────────────────
const HK_CHASSIS_RX = /\b(DN8|CN7|DH|G70|G80|G90|JD|YK|FE|MQ4)\b/gi;
const HK_ENGINE_RX = /\b(Theta|Lambda|Smartstream|Gamma|G6DJ|G6DM)\b/gi;

// ───────────────────────────── VW ──────────────────────────────
const VW_CHASSIS_RX = /\b(MK[1-9]|MQB|MLB|MEB|8V|8Y|B[5-9])\b/gi;
const VW_ENGINE_RX = /\b(EA113|EA888|EA839|EA211|EA837)\b/gi;

// ──────────────────────── Year ranges ──────────────────────────
// Matches "2016-2019", "2020-2025", "2015-present", "2018+"
const YEAR_RX = /\b(20\d{2})\s*[-–]\s*(20\d{2}|present|now|current)\b|\b(20\d{2})\s*\+\b/g;

// ───────────────────── BMW engine-to-model whitelist ───────────────────
// Source: BMW Group official engine designations.
// For M-cars (strict): only their actual engine families allowed.
// For non-M models: all engines pass through (engines are shared across many trims).
const BMW_M_MODEL_ENGINES = {
  // M2: N55B30 (F87 2016-18) → S55 (F87 Comp 2019-21) → S58 (G87 2023+)
  M2: new Set(['N55', 'S55', 'S58']),
  // M3: S14 (E30) → S50/S52 (E36) → S54 (E46) → S65 V8 (E90/E92/E93) → S55 (F80) → S58 (G80)
  M3: new Set(['S14', 'S50', 'S52', 'S54', 'S65', 'S55', 'S58']),
  // M4: S55 (F82/F83) → S58 (G82/G83)
  M4: new Set(['S55', 'S58']),
  // M5: S38 (E28/E34) → S62 (E39 V8) → S85 (E60 V10) → S63 (F10/F90) → S68 (G90/G99)
  M5: new Set(['S38', 'S62', 'S85', 'S63', 'S68']),
  // X3M / X4M: S55 (F97/F98 pre-LCI) → S58 (LCI)
  X3M: new Set(['S55', 'S58']),
  X4M: new Set(['S55', 'S58']),
  // X5M / X6M: S63 (F85/F86) → S63 (F95/F96 LCI same family)
  X5M: new Set(['S63']),
  X6M: new Set(['S63']),
  // XM: S68 plug-in hybrid (G09)
  XM: new Set(['S68']),
  // Electric — no ICE engines
  i3: new Set([]),
  i4: new Set([]),
  i5: new Set([]),
  i7: new Set([]),
  i8: new Set([]),
};

// ───────────────────────── BMW model lookup ─────────────────────
// Map a chassis code to BMW model family (canonical 1:1 mapping for filter attribution)
const BMW_CHASSIS_TO_MODEL = {
  // 1 Series
  E81: '1-Series', E82: '1-Series', E87: '1-Series', E88: '1-Series',
  F20: '1-Series', F21: '1-Series', F40: '1-Series', F52: '1-Series',
  // 2 Series
  F22: '2-Series', F23: '2-Series', F44: '2-Series', F45: '2-Series', F46: '2-Series',
  F87: 'M2',
  G42: '2-Series', G87: 'M2', U06: '2-Series',
  // 3 Series
  E21: '3-Series', E30: '3-Series', E36: '3-Series', E46: '3-Series',
  E90: '3-Series', E91: '3-Series', E92: '3-Series', E93: '3-Series',
  F30: '3-Series', F31: '3-Series', F34: '3-Series', F35: '3-Series', F80: 'M3',
  G20: '3-Series', G21: '3-Series', G28: '3-Series', G80: 'M3', G81: 'M3',
  // 4 Series
  F32: '4-Series', F33: '4-Series', F36: '4-Series', F82: 'M4', F83: 'M4',
  G22: '4-Series', G23: '4-Series', G26: '4-Series', G82: 'M4', G83: 'M4',
  // 5 Series — generational chassis cover BOTH 5-Series AND M5 variants.
  // Only F90/G90/G99 are M5-exclusive chassis codes.
  E12: '5-Series', E28: '5-Series', E34: '5-Series', E39: '5-Series',
  E60: '5-Series', E61: '5-Series',
  F10: '5-Series', F11: '5-Series', F18: '5-Series', F90: 'M5',
  G30: '5-Series', G31: '5-Series', G38: '5-Series',
  G60: '5-Series', G61: '5-Series', G68: '5-Series',
  G90: 'M5', G99: 'M5',
  // 6 Series
  E24: '6-Series', E63: '6-Series', E64: '6-Series',
  F06: '6-Series', F12: '6-Series', F13: '6-Series',
  G32: '6-Series',
  // 7 Series
  E23: '7-Series', E32: '7-Series', E38: '7-Series', E65: '7-Series', E66: '7-Series',
  F01: '7-Series', F02: '7-Series', F03: '7-Series', F04: '7-Series',
  G11: '7-Series', G12: '7-Series', G70: '7-Series',
  // 8 Series
  E31: '8-Series', G14: '8-Series', G15: '8-Series', G16: '8-Series',
  // X Series
  E53: 'X5', E70: 'X5', E71: 'X6', E72: 'X6',
  E83: 'X3', E84: 'X1',
  F15: 'X5', F16: 'X6', F25: 'X3', F26: 'X4', F39: 'X2', F48: 'X1', F49: 'X1',
  F85: 'X5M', F86: 'X6M',
  F95: 'X5M', F96: 'X6M', F97: 'X3M', F98: 'X4M',
  G01: 'X3', G02: 'X4', G05: 'X5', G06: 'X6', G07: 'X7', G08: 'X3', G09: 'XM',
  G18: '3-Series', G45: 'X3',
  U10: 'X1', U11: 'X1', U12: 'X2', U25: 'X3',
  // Z Series
  E52: 'Z4', E85: 'Z4', E86: 'Z4', E89: 'Z4', G29: 'Z4',
  // i Series (electric)
  I01: 'i3', I12: 'i8', I15: 'i8', I20: 'i4', I22: 'i5',
};

// ───────────────────────── Toyota model lookup ─────────────────
const TOYOTA_CHASSIS_TO_MODEL = {
  A90: 'Supra', A91: 'Supra', J29: 'GR-Corolla',
};

// ─────────────────────── Hyundai/Kia model lookup ──────────────
const HK_CHASSIS_TO_MODEL = {
  DN8: 'Sonata', CN7: 'Elantra', DH: 'Genesis', G70: 'G70', G80: 'G80', G90: 'G90',
  JD: 'Forte', YK: 'Stinger', FE: 'Veloster', MQ4: 'Sorento',
};

// ─────────────────────── Mercedes W-codes ──────────────────────
// W205 (C-Class), W213 (E-Class), W222 (S-Class), W463 (G-Wagon), C190 (AMG GT)
const MB_CHASSIS_RX = /\b(W\d{3}|C190|C167|X167|X156|X253|X254|R170|R171|R172|R232|S205|S213|S214)\b/gi;
const MB_CHASSIS_TO_MODEL = {
  W204: 'C-Class', W205: 'C-Class', W206: 'C-Class',
  W212: 'E-Class', W213: 'E-Class', W214: 'E-Class',
  W221: 'S-Class', W222: 'S-Class', W223: 'S-Class',
  W463: 'G-Class',
  W156: 'GLA', W253: 'GLC', W292: 'GLE', W166: 'GLE', W167: 'GLE',
  C190: 'AMG-GT', C167: 'GLE-Coupe', X167: 'GLS',
  R230: 'SL', R231: 'SL', R232: 'SL',
  S205: 'C-Class', S213: 'E-Class',
};
const MB_ENGINE_RX = /\b(M133|M139|M152|M156|M157|M176|M177|M178|M256|M260|M264|M270|M274|M276|M278|M282)\b/gi;

// ──────────────────────── Ford models ──────────────────────────
const FORD_MODEL_RX = /\b(F-?150|F-?250|F-?350|Raptor(?:\s+R)?|Mustang(?:\s+(?:GT|EcoBoost|Mach-?E|Dark\s*Horse))?|Bronco(?:\s+Sport|\s+Raptor)?|Explorer|Edge|Focus(?:\s+(?:RS|ST))?|Fiesta(?:\s+ST)?|Ranger|Maverick|Escape)\b/gi;
const FORD_MODEL_NORMALIZE = (m) => {
  const x = m.toLowerCase().replace(/[\s-]+/g, '');
  if (/^f150/.test(x)) return 'F-150';
  if (/^f250/.test(x)) return 'F-250';
  if (/^f350/.test(x)) return 'F-350';
  if (/^raptor/.test(x)) return 'Raptor';
  if (/^mustang/.test(x)) return 'Mustang';
  if (/^bronco/.test(x)) return 'Bronco';
  if (/^focus/.test(x)) return 'Focus';
  if (/^fiesta/.test(x)) return 'Fiesta';
  if (/^ranger/.test(x)) return 'Ranger';
  if (/^explorer/.test(x)) return 'Explorer';
  if (/^edge/.test(x)) return 'Edge';
  if (/^maverick/.test(x)) return 'Maverick';
  if (/^escape/.test(x)) return 'Escape';
  return m;
};

// ──────────────────────── Porsche models ───────────────────────
const PORSCHE_CHASSIS_RX = /\b(99[1-2]|981|982|718|95[78]|97[01]|992)\b/g;
const PORSCHE_MODEL_RX = /\b(Carrera|911|Cayenne|Panamera|Macan|Boxster|Cayman|Taycan|Targa|Turbo\s?S?|GT[234](?:\s?RS)?)\b/gi;

// ──────────────────────── Subaru models ────────────────────────
const SUBARU_MODEL_RX = /\b(WRX|STI|BRZ|Forester|Outback|Legacy|Crosstrek|Impreza|Ascent)\b/gi;

// ──────────────────────── Mini models ──────────────────────────
const MINI_MODEL_RX = /\b(Cooper(?:\s+S|\s+SE|\s+Works|\s+JCW)?|Clubman|Countryman|Paceman|Roadster)\b/gi;
const MINI_CHASSIS_RX = /\b(R5[0-9]|R6[0-1]|F5[0-9]|F6[0-1]|J0[0-9])\b/g;

// ─────────────────── Other brands (model regexes) ──────────────
const NISSAN_MODEL_RX = /\b(GT-?R|370Z|350Z|Z\b|Altima|Maxima|Skyline|Pathfinder|Titan|Sentra|Frontier|Murano|Rogue|Patrol|Juke|Armada)\b/gi;
const INFINITI_MODEL_RX = /\b(Q50|Q60|Q70|Q80|QX[3-8]0|QX55|G35|G37)\b/gi;
const CHEVROLET_MODEL_RX = /\b(Camaro|Corvette|Silverado|Tahoe|Suburban|Cruze|Malibu|Impala|Equinox|Traverse|Trailblazer|Colorado|Blazer|Trax)\b/gi;
const TESLA_MODEL_RX = /\b(Model\s?[SXY3]|Cybertruck|Roadster)\b/gi;
const LEXUS_MODEL_RX = /\b(IS\s?\d{3}|GS\s?\d{3}|LS\s?\d{3}|RC\s?[F\d]+|LC\s?\d{3}|RX\s?\d{3}|GX\s?\d{3}|LX\s?\d{3}|NX\s?\d{3}|UX\s?\d{3}|ES\s?\d{3})\b/gi;
const MAZDA_MODEL_RX = /\b(MX-?5|Miata|RX-?[78]|CX-?[3-9]|Mazda\s?[2356]|Mazdaspeed[36]?)\b/gi;
const RAM_MODEL_RX = /\b(1500\s?TRX|1500|2500|3500|ProMaster|Rebel)\b/gi;
const JEEP_MODEL_RX = /\b(Wrangler|Cherokee|Grand\s?Cherokee|Compass|Renegade|Gladiator|Wagoneer)\b/gi;
const HONDA_MODEL_RX = /\b(Civic(?:\s+(?:Type\s?R|Si|SI))?|Accord|CR-?V|HR-?V|Pilot|Odyssey|Ridgeline|Passport|Insight|Fit)\b/gi;
const ACURA_MODEL_RX = /\b(NSX|TLX|MDX|RDX|ILX|TSX|TL|RSX|Integra|Type\s?S)\b/gi;
const DODGE_MODEL_RX = /\b(Charger|Challenger|Durango|Hellcat|SRT|Demon|Hornet)\b/gi;
const ALFA_MODEL_RX = /\b(Giulia|Stelvio|4C|Quadrifoglio|Tonale)\b/gi;
const RANGE_ROVER_MODEL_RX = /\b(Range\s?Rover(?:\s+(?:Sport|Velar|Evoque))?|Defender|Discovery)\b/gi;
const MASERATI_MODEL_RX = /\b(Ghibli|Quattroporte|Levante|GranTurismo|GranCabrio|MC20|Grecale)\b/gi;
const LOTUS_MODEL_RX = /\b(Emira|Evora|Exige|Elise|Eletre|Evija)\b/gi;
const CADILLAC_MODEL_RX = /\b(CTS(?:-V)?|ATS(?:-V)?|CT[456](?:-V)?|XT[456]|Escalade|SRX|XTS|STS|DTS|Eldorado|ELR)\b/gi;
const VOLVO_MODEL_RX = /\b(S60|S90|V60|V90|XC[456]0|C40|EX[39]0)\b/gi;
const FIAT_MODEL_RX = /\b(500(?:X|L|e|c)?|Abarth|124(?:\s?Spider)?|Panda)\b/gi;
const MCLAREN_MODEL_RX = /\b(720S|750S|765LT|570S|600LT|GT|Artura|Senna|Speedtail|P1|MP4)\b/gi;
const ASTON_MARTIN_MODEL_RX = /\b(DB[1-9]|Vantage|DBX|DBS|Vanquish|Rapide|Valkyrie|Valhalla)\b/gi;

function normRX(text, rx, normalize = normalizeModel) {
  const out = new Set();
  rx.lastIndex = 0;
  let m;
  while ((m = rx.exec(text))) {
    const norm = normalize(m[0]).replace(/\s+/g, ' ').trim();
    if (norm) out.add(norm);
  }
  return [...out];
}

function uniq(arr) { return [...new Set(arr)]; }

function normalizeModel(m) {
  const s = m.replace(/\s+/g, ' ').trim();
  // BMW i-electric models stay lowercase (i4, i7, i8, iX, iX1, iX3)
  if (/^i([3-8]|X[1-3]?)$/i.test(s)) return s.charAt(0).toLowerCase() + s.slice(1).toUpperCase().replace(/^I/, '');
  if (/^iX[1-3]?$/i.test(s)) return 'i' + s.slice(1).toUpperCase();
  // Tesla "Model S/X/Y/3"
  if (/^Model\s?[SXY3]$/i.test(s)) return 'Model ' + s.slice(-1).toUpperCase();
  // Common all-caps acronyms — keep upper
  const upperList = /^(GTI|GTS|RS\d?|R\b|STI|WRX|TT|X[1-7]M?|M[1-9]|GT[234](?:\s?RS)?|AMG\s?GT|SLS|SLR|DBX|MX-?5|RX-?[78]|CX-?\d+|F-?\d{3}|RAV4|HR-?V|CR-?V|PT|TRX|SVR|XM|GT)$/i;
  if (upperList.test(s)) return s.toUpperCase();
  // Mercedes-style "GLC63" / "GLC 63" → unified "GLC 63" (only multi-letter Mercedes prefixes)
  const mb = s.match(/^(GLA|GLB|GLC|GLE|GLS|AMG\s?GT)\s?(\d{2,3})$/i);
  if (mb) return `${mb[1].toUpperCase()} ${mb[2]}`;
  // Genesis G70/G80/G90 — keep tight format
  if (/^G\s?[789]0$/i.test(s)) return 'G' + s.replace(/\D/g, '');
  // Otherwise title case each word/hyphen-part
  return s.split(' ').map(w => {
    if (/^[A-Z]{2,}\d*$/.test(w)) return w;
    if (/^\d/.test(w)) return w;
    return w.split('-').map(part => {
      if (/^[A-Z]{2,}\d*$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join('-');
  }).join(' ');
}

// Genesis codes that conflict with BMW chassis — if any of these brands present,
// G70/G80/G90 mean Genesis, not BMW
const GENESIS_BRANDS = new Set(['Hyundai', 'Kia']);
const GENESIS_OVERRIDE_CODES = new Set(['G70', 'G80', 'G90']);

function extractFitmentForBrand(brand, text, allBrands) {
  const tags = new Set();
  const detail = { chassis: [], engine: [], model: [], years: [] };
  const hasGenesis = [...allBrands].some(b => GENESIS_BRANDS.has(b));
  const hasBmw = allBrands.has('BMW');

  if (brand === 'BMW') {
    // Chassis — strict whitelist (rejects Mini F54-F60, Infiniti G35/G37/I35, "E10" fuel, etc.)
    const chassisMatches = text.match(BMW_CHASSIS_RX) || [];
    for (const c of chassisMatches) {
      const norm = c.toUpperCase();
      if (!BMW_CHASSIS_VALID.test(norm)) continue;
      if (!BMW_CHASSIS_WHITELIST.has(norm)) continue;
      // If Genesis brand also present, skip G70/G80/G90 (they're Hyundai/Kia models)
      if (hasGenesis && GENESIS_OVERRIDE_CODES.has(norm)) continue;
      // E85 false positive — check fuel context
      if (norm === 'E85' && E85_FUEL_CONTEXT.test(text)) continue;
      detail.chassis.push(norm);
      tags.add(`chassis:${norm}`);
      const model = BMW_CHASSIS_TO_MODEL[norm];
      if (model) {
        detail.model.push(model);
        tags.add(`model:${model}`);
      }
    }
    // Engines
    const engineMatches = text.match(BMW_ENGINE_RX) || [];
    for (const e of engineMatches) {
      const norm = e.toUpperCase();
      detail.engine.push(norm);
      tags.add(`engine:${norm}`);
    }
  }

  if (brand === 'Toyota') {
    const cm = text.match(TOYOTA_CHASSIS_RX) || [];
    for (const c of cm) {
      const norm = c.replace(/\s+/g, '').toUpperCase();
      if (TOYOTA_CHASSIS_TO_MODEL[norm]) {
        detail.chassis.push(norm);
        tags.add(`chassis:${norm}`);
        detail.model.push(TOYOTA_CHASSIS_TO_MODEL[norm]);
        tags.add(`model:${TOYOTA_CHASSIS_TO_MODEL[norm]}`);
      }
    }
    const em = text.match(TOYOTA_ENGINE_RX) || [];
    for (const e of em) {
      const norm = e.toUpperCase();
      detail.engine.push(norm);
      tags.add(`engine:${norm}`);
    }
    // Model names (Supra, Tundra, GR Corolla etc.)
    let mm;
    TOYOTA_MODEL_RX.lastIndex = 0;
    while ((mm = TOYOTA_MODEL_RX.exec(text))) {
      const norm = mm[0].replace(/\s+/g, ' ').trim();
      detail.model.push(norm);
      tags.add(`model:${norm}`);
    }
  }

  if (brand === 'Hyundai' || brand === 'Kia') {
    const cm = text.match(HK_CHASSIS_RX) || [];
    for (const c of cm) {
      const norm = c.toUpperCase();
      if (HK_CHASSIS_TO_MODEL[norm]) {
        detail.chassis.push(norm);
        tags.add(`chassis:${norm}`);
        detail.model.push(HK_CHASSIS_TO_MODEL[norm]);
        tags.add(`model:${HK_CHASSIS_TO_MODEL[norm]}`);
      }
    }
    // Common model names
    if (/\bStinger\b/i.test(text)) { detail.model.push('Stinger'); tags.add('model:Stinger'); }
    if (/\bSonata\b/i.test(text)) { detail.model.push('Sonata'); tags.add('model:Sonata'); }
    if (/\bElantra\b/i.test(text)) { detail.model.push('Elantra'); tags.add('model:Elantra'); }
    if (/\bGenesis\b/i.test(text)) { detail.model.push('Genesis'); tags.add('model:Genesis'); }
    if (/\bVeloster\b/i.test(text)) { detail.model.push('Veloster'); tags.add('model:Veloster'); }
  }

  if (brand === 'VW' || brand === 'Audi') {
    const cm = text.match(VW_CHASSIS_RX) || [];
    for (const c of cm) {
      const norm = c.toUpperCase();
      detail.chassis.push(norm);
      tags.add(`chassis:${norm}`);
    }
    const em = text.match(VW_ENGINE_RX) || [];
    for (const e of em) {
      const norm = e.toUpperCase();
      detail.engine.push(norm);
      tags.add(`engine:${norm}`);
    }
    // Common VW/Audi model words
    if (brand === 'VW') {
      const vwModels = ['Golf', 'Jetta', 'Passat', 'Tiguan', 'Atlas', 'Arteon', 'Beetle', 'Polo', 'Touareg', 'ID\\.[34]', 'GTI', 'R\\b'];
      for (const m of vwModels) {
        const rx = new RegExp(`\\b(${m})\\b`, 'i');
        const match = text.match(rx);
        if (match) {
          const norm = match[1].replace('.', '').replace(/\\b/g, '');
          detail.model.push(norm);
          tags.add(`model:${norm}`);
        }
      }
    }
    if (brand === 'Audi') {
      const audiModels = /\b(A[1-8]|Q[2-8]|S[3-8]|RS[3-8]?|TT|R8|e-tron)\b/g;
      let m;
      while ((m = audiModels.exec(text))) {
        detail.model.push(m[1]);
        tags.add(`model:${m[1]}`);
      }
    }
  }

  if (brand === 'Mercedes') {
    const cm = text.match(MB_CHASSIS_RX) || [];
    for (const c of cm) {
      const norm = c.toUpperCase();
      detail.chassis.push(norm);
      tags.add(`chassis:${norm}`);
      const model = MB_CHASSIS_TO_MODEL[norm];
      if (model) {
        detail.model.push(model);
        tags.add(`model:${model}`);
      }
    }
    const em = text.match(MB_ENGINE_RX) || [];
    for (const e of em) {
      const norm = e.toUpperCase();
      detail.engine.push(norm);
      tags.add(`engine:${norm}`);
    }
    // AMG-named models from text
    const amgRx = /\b(AMG\s?GT|C\d{2}\s?AMG|E\d{2}\s?AMG|S\d{2}\s?AMG|GLA\s?\d+|GLC\s?\d+|GLE\s?\d+|GLS\s?\d+|G\s?\d+|G-?Wagon)\b/gi;
    let am;
    while ((am = amgRx.exec(text))) {
      const norm = am[1].replace(/\s+/g, ' ').trim();
      detail.model.push(norm);
      tags.add(`model:${norm}`);
    }
  }

  if (brand === 'Ford') {
    let m;
    FORD_MODEL_RX.lastIndex = 0;
    while ((m = FORD_MODEL_RX.exec(text))) {
      const norm = FORD_MODEL_NORMALIZE(m[0]);
      detail.model.push(norm);
      tags.add(`model:${norm}`);
    }
  }

  if (brand === 'Porsche') {
    const cm = text.match(PORSCHE_CHASSIS_RX) || [];
    for (const c of cm) {
      detail.chassis.push(c);
      tags.add(`chassis:${c}`);
    }
    let m;
    PORSCHE_MODEL_RX.lastIndex = 0;
    while ((m = PORSCHE_MODEL_RX.exec(text))) {
      const norm = m[1].replace(/\s+/g, ' ').trim();
      detail.model.push(norm);
      tags.add(`model:${norm}`);
    }
  }

  if (brand === 'Subaru') {
    let m;
    SUBARU_MODEL_RX.lastIndex = 0;
    while ((m = SUBARU_MODEL_RX.exec(text))) {
      detail.model.push(m[1]);
      tags.add(`model:${m[1]}`);
    }
  }

  if (brand === 'Mini') {
    const cm = text.match(MINI_CHASSIS_RX) || [];
    for (const c of cm) {
      const norm = c.toUpperCase();
      detail.chassis.push(norm);
      tags.add(`chassis:${norm}`);
    }
    let m;
    MINI_MODEL_RX.lastIndex = 0;
    while ((m = MINI_MODEL_RX.exec(text))) {
      const norm = m[1].replace(/\s+/g, ' ').trim();
      detail.model.push(norm);
      tags.add(`model:${norm}`);
    }
  }

  // Generic model-only brands
  const SIMPLE_BRAND_PATTERNS = {
    Nissan: NISSAN_MODEL_RX,
    Infiniti: INFINITI_MODEL_RX,
    Chevrolet: CHEVROLET_MODEL_RX,
    Tesla: TESLA_MODEL_RX,
    Lexus: LEXUS_MODEL_RX,
    Mazda: MAZDA_MODEL_RX,
    RAM: RAM_MODEL_RX,
    Jeep: JEEP_MODEL_RX,
    Honda: HONDA_MODEL_RX,
    Acura: ACURA_MODEL_RX,
    Dodge: DODGE_MODEL_RX,
    'Alfa Romeo': ALFA_MODEL_RX,
    'Range Rover': RANGE_ROVER_MODEL_RX,
    Maserati: MASERATI_MODEL_RX,
    Lotus: LOTUS_MODEL_RX,
    Cadillac: CADILLAC_MODEL_RX,
    Volvo: VOLVO_MODEL_RX,
    Fiat: FIAT_MODEL_RX,
    McLaren: MCLAREN_MODEL_RX,
    'Aston Martin': ASTON_MARTIN_MODEL_RX,
  };
  const simpleRx = SIMPLE_BRAND_PATTERNS[brand];
  if (simpleRx) {
    for (const m of normRX(text, simpleRx)) {
      detail.model.push(m);
      tags.add(`model:${m}`);
    }
  }

  // Normalize model casing & dedupe
  const normalizedModels = uniq(detail.model.map(normalizeModel));
  detail.model = normalizedModels;
  detail.chassis = uniq(detail.chassis);
  detail.engine = uniq(detail.engine);

  // Rebuild tag set with normalized models (drop raw model: tags, re-add normalized)
  const cleanTags = new Set([...tags].filter(t => !t.startsWith('model:')));
  for (const m of normalizedModels) cleanTags.add(`model:${m}`);

  return { tags: [...cleanTags], detail };
}

// ─────────────────────────── Run ───────────────────────────────
const products = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
const enriched = [];
const summary = {
  total: products.length,
  byBrand: {},
  withChassis: 0,
  withEngine: 0,
  withModel: 0,
  withYear: 0,
};

// Per-brand option aggregation (for hero picker) — keeps brand→model→chassis attribution honest
// optionsByBrand[brand] = { count, models: Map<model, { count, chassis: Set, engines: Set }>, allChassis: Set, allEngines: Set }
const optionsByBrand = new Map();

for (const p of products) {
  const brandTags = (p.tags || []).filter(t => t.startsWith('brand:')).map(t => t.slice(6));
  const allBrands = new Set(brandTags);
  const newTags = new Set(p.tags || []);
  const detailByBrand = {};

  // Combine title + description so short-described products still get fitment
  const fitmentText = `${p.title || ''}\n${p.descriptionEn || ''}`;

  for (const brand of brandTags) {
    const { tags, detail } = extractFitmentForBrand(brand, fitmentText, allBrands);
    for (const t of tags) newTags.add(t);
    if (detail.chassis.length || detail.engine.length || detail.model.length || detail.years.length) {
      detailByBrand[brand] = detail;
    }

    // Aggregate per-brand options
    if (brand !== 'Universal') {
      if (!optionsByBrand.has(brand)) {
        optionsByBrand.set(brand, {
          count: 0,
          models: new Map(),
          allChassis: new Set(),
          allEngines: new Set(),
        });
      }
      const bd = optionsByBrand.get(brand);
      bd.count++;

      // Reverse chassis-to-model map for canonical attribution
      let chassisToModel = null;
      if (brand === 'BMW') chassisToModel = BMW_CHASSIS_TO_MODEL;
      else if (brand === 'Toyota') chassisToModel = TOYOTA_CHASSIS_TO_MODEL;
      else if (brand === 'Hyundai' || brand === 'Kia') chassisToModel = HK_CHASSIS_TO_MODEL;
      else if (brand === 'Mercedes') chassisToModel = MB_CHASSIS_TO_MODEL;

      for (const m of detail.model) {
        if (!bd.models.has(m)) bd.models.set(m, { count: 0, chassis: new Set(), engines: new Set() });
        const md = bd.models.get(m);
        md.count++;
        if (chassisToModel) {
          // Only attach chassis that canonically belong to THIS model
          for (const c of detail.chassis) {
            if (chassisToModel[c] === m) md.chassis.add(c);
          }
        } else {
          for (const c of detail.chassis) md.chassis.add(c);
        }
        // Engines: for BMW M-cars, restrict to known-correct engine families.
        // For non-M models (Series, X1-X7, Z, i), engines are shared across trims — attach all.
        const mEngineWhitelist = brand === 'BMW' ? BMW_M_MODEL_ENGINES[m] : null;
        if (mEngineWhitelist) {
          for (const e of detail.engine) {
            if (mEngineWhitelist.has(e)) md.engines.add(e);
          }
        } else {
          for (const e of detail.engine) md.engines.add(e);
        }
      }
      for (const c of detail.chassis) bd.allChassis.add(c);
      for (const e of detail.engine) bd.allEngines.add(e);
    }
  }

  const out = { ...p, tags: [...newTags] };
  enriched.push(out);

  // summary
  for (const brand of brandTags) {
    summary.byBrand[brand] = summary.byBrand[brand] || { total: 0, withChassis: 0, withEngine: 0, withModel: 0, withYear: 0 };
    summary.byBrand[brand].total++;
    const d = detailByBrand[brand];
    if (d?.chassis.length) summary.byBrand[brand].withChassis++;
    if (d?.engine.length) summary.byBrand[brand].withEngine++;
    if (d?.model.length) summary.byBrand[brand].withModel++;
    if (d?.years.length) summary.byBrand[brand].withYear++;
  }
  if ([...newTags].some(t => t.startsWith('chassis:'))) summary.withChassis++;
  if ([...newTags].some(t => t.startsWith('engine:'))) summary.withEngine++;
  if ([...newTags].some(t => t.startsWith('model:'))) summary.withModel++;
  if ([...newTags].some(t => t.startsWith('year:'))) summary.withYear++;
}

fs.writeFileSync(OUT, JSON.stringify(enriched, null, 2));

// Serialize per-brand picker options
const pickerOptions = {};
const sortedBrands = [...optionsByBrand.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [brand, bd] of sortedBrands) {
  pickerOptions[brand] = {
    count: bd.count,
    models: Object.fromEntries(
      [...bd.models.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([m, md]) => [m, {
          count: md.count,
          chassis: [...md.chassis].sort(),
          engines: [...md.engines].sort(),
        }])
    ),
    allChassis: [...bd.allChassis].sort(),
    allEngines: [...bd.allEngines].sort(),
  };
}
const PICKER_OUT = path.join(process.cwd(), 'src', 'app', '[locale]', 'shop', 'data', 'burgerFitmentOptions.json');
fs.writeFileSync(PICKER_OUT, JSON.stringify(pickerOptions, null, 2));
console.log(`✓ Wrote picker options: ${path.relative(process.cwd(), PICKER_OUT)}`);

console.log(`\n=== FITMENT EXTRACTION REPORT ===\n`);
console.log(`Total products: ${summary.total}`);
console.log(`With chassis tag: ${summary.withChassis} (${Math.round(summary.withChassis/summary.total*100)}%)`);
console.log(`With engine tag:  ${summary.withEngine} (${Math.round(summary.withEngine/summary.total*100)}%)`);
console.log(`With model tag:   ${summary.withModel} (${Math.round(summary.withModel/summary.total*100)}%)`);
console.log(`With year tag:    ${summary.withYear} (${Math.round(summary.withYear/summary.total*100)}%)`);

console.log(`\nPer-brand coverage:`);
const sorted = Object.entries(summary.byBrand).sort((a,b)=>b[1].total-a[1].total);
for (const [brand, s] of sorted) {
  console.log(`  ${brand.padEnd(15)} ${String(s.total).padStart(4)} | chassis ${String(s.withChassis).padStart(3)} | engine ${String(s.withEngine).padStart(3)} | model ${String(s.withModel).padStart(3)} | year ${String(s.withYear).padStart(3)}`);
}

// Sample 5 BMW products with extracted fitment
console.log(`\nBMW SAMPLES (first 6 with fitment):`);
const bmwSamples = enriched.filter(p =>
  (p.tags||[]).includes('brand:BMW') &&
  (p.tags||[]).some(t => t.startsWith('chassis:'))
).slice(0,6);
for (const p of bmwSamples) {
  const fitTags = (p.tags||[]).filter(t => /^(chassis|engine|model|year):/.test(t));
  console.log(`  - ${p.title.slice(0,80)}`);
  console.log(`    ${fitTags.join(', ')}`);
}

console.log(`\n✓ Written: ${path.relative(process.cwd(), OUT)}`);
