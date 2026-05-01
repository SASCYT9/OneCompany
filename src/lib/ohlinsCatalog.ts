import type { ShopProduct } from '@/lib/shopCatalog';

type OhlinsCatalogProduct = Pick<ShopProduct, 'slug' | 'title' | 'shortDescription'>;

export const OHLINS_SLUG_PREFIX_TO_MAKE: Record<string, string> = {
  aus: 'Audi',
  auv: 'Audi',
  alv: 'Alpine',
  bms: 'BMW',
  bmv: 'BMW',
  bmz: 'BMW',
  fos: 'Ford',
  fov: 'Ford',
  hos: 'Honda',
  hov: 'Honda',
  hys: 'Hyundai',
  inv: 'INEOS',
  isv: 'Isuzu',
  jev: 'Jeep',
  les: 'Lexus',
  lof: 'Lotus',
  lov: 'Lotus',
  mas: 'Maserati',
  mcs: 'Mini',
  mev: 'Mercedes-Benz',
  mes: 'Mercedes-Benz',
  mis: 'Mitsubishi',
  mir: 'Mitsubishi',
  miz: 'Mitsubishi',
  nis: 'Nissan',
  nir: 'Nissan',
  pof: 'Porsche',
  por: 'Porsche',
  pos: 'Porsche',
  pov: 'Porsche',
  poz: 'Porsche',
  sef: 'SEAT',
  sur: 'Subaru',
  sus: 'Subaru',
  suv: 'Suzuki',
  tes: 'Tesla',
  tos: 'Toyota',
  tov: 'Toyota',
  vaf: 'Volkswagen/Audi',
  vws: 'Volkswagen',
};

export const OHLINS_UNIVERSAL_PRODUCT_PATTERNS: RegExp[] = [
  /\bformula\s+student\b/i,
  /\bhelper\s+spring\b/i,
  /\bsprings?\b/i,
  /\bwrench\b/i,
  /\bspanner\b/i,
  /\bпідшипник\b/i,
  /\bbearing\b/i,
  /\bdust\s+boot\b/i,
  /\bbump\s+stop\b/i,
  /\bbumper\b/i,
  /\bcontrol\s+cable\b/i,
  /\bcontrol\s+lever\b/i,
  /\badjust(?:ment|er)\b/i,
  /\bend\s+(?:eyelet|bracket)\b/i,
  /\bhex\s+nut\b/i,
  /\bwheel\s+spacer\b/i,
  /\bspacer\b/i,
  /\bbushing\b/i,
  /\bgasket\b/i,
  /\badapter\s+kit\b/i,
  /\bstabilizer\s+bracket\b/i,
];

export const OHLINS_CATEGORY_PATTERNS: { match: RegExp; label: string; labelUa: string }[] = [
  { match: /road\s*[&]\s*track|койловер/i, label: 'Road & Track', labelUa: 'Road & Track' },
  { match: /advanced\s*track\s*day|trackday/i, label: 'Advanced Trackday', labelUa: 'Advanced Trackday' },
  { match: /motorsport|grp?\s*n|cup|tcr|race/i, label: 'Motorsport', labelUa: 'Motorsport' },
  { match: /off[\s-]*road|adventure|hilux|jimny|grenadier/i, label: 'Off-Road & Adventure', labelUa: 'Off-Road & Adventure' },
  { match: /електронн|electronic|edc|pasm/i, label: 'Electronics (EDC)', labelUa: 'Електроніка (EDC)' },
  { match: /shock\s+absorber|damper/i, label: 'Shock Absorbers', labelUa: 'Амортизатори' },
  {
    match:
      /верхня опора|top mount|strut mount|upper mount|shock mount|adapter kit|mount kit|deactivation kit|expansion package|підшипник|bearing|dust boot|bump stop|bumper|gasket|stabilizer bracket|end eyelet|end bracket|adjust(?:ment|er)|control cable|control lever|bracket|bushing|hex nut|wheel spacer|spacer/i,
    label: 'Mounts & Hardware',
    labelUa: 'Опори та кріплення',
  },
  { match: /пружин|spring/i, label: 'Springs', labelUa: 'Пружини' },
  { match: /wrench|spanner|tool/i, label: 'Tools & Accessories', labelUa: 'Інструмент та аксесуари' },
];

const OHLINS_TITLE_BRANDS = [
  'BMW',
  'Porsche',
  'Audi',
  'Chevrolet',
  'Mercedes',
  'Ford',
  'Honda',
  'Nissan',
  'Toyota',
  'Subaru',
  'Mitsubishi',
  'Volkswagen',
  'VW',
  'Hyundai',
  'Lexus',
  'Mazda',
  'Mini',
  'Lotus',
  'Alpine',
  'Maserati',
  'Tesla',
  'SEAT',
  'Jeep',
  'Suzuki',
  'INEOS',
  'Isuzu',
] as const;

function getOhlinsTitle(product: Pick<OhlinsCatalogProduct, 'title'>) {
  return `${product.title?.en ?? ''} ${product.title?.ua ?? ''}`.trim();
}

export function detectOhlinsMake(product: Pick<OhlinsCatalogProduct, 'slug' | 'title'>): string | null {
  const title = getOhlinsTitle(product);
  const upperTitle = title.toUpperCase();

  // Title-based detection wins over slug prefix to avoid collisions
  // (e.g. slug `ohlins-mas-...` could be Mazda OR Maserati — title disambiguates).
  for (const brand of OHLINS_TITLE_BRANDS) {
    if (upperTitle.includes(brand.toUpperCase())) {
      if (brand === 'VW') return 'Volkswagen';
      if (brand === 'Mercedes') return 'Mercedes-Benz';
      return brand;
    }
  }

  // Fallback to slug prefix when title has no make name (springs, hardware, etc.)
  const slugBody = product.slug.replace(/^ohlins-/, '');
  const prefix = slugBody.split('-')[0]?.toLowerCase();
  if (prefix && OHLINS_SLUG_PREFIX_TO_MAKE[prefix]) {
    return OHLINS_SLUG_PREFIX_TO_MAKE[prefix];
  }

  if (/\bVAG\b/i.test(title)) {
    return 'Volkswagen/Audi';
  }

  if (/\bCOOPER\b|\bCLUBMAN\b|\bROADSTER\b|\bCOUNTRYMAN\b/i.test(title)) {
    return 'Mini';
  }

  if (OHLINS_UNIVERSAL_PRODUCT_PATTERNS.some((pattern) => pattern.test(title))) {
    return 'Universal';
  }

  return null;
}

export function detectOhlinsCategory(
  product: Pick<OhlinsCatalogProduct, 'title' | 'shortDescription'>
): { label: string; labelUa: string } | null {
  const text = `${product.title?.en ?? ''} ${product.title?.ua ?? ''} ${product.shortDescription?.en ?? ''}`;
  for (const pattern of OHLINS_CATEGORY_PATTERNS) {
    if (pattern.match.test(text)) {
      return { label: pattern.label, labelUa: pattern.labelUa };
    }
  }

  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Industry-known chassis-code → human model name mapping. Chassis codes are
 * stable identifiers across automotive references. Used to label cascade
 * dropdowns derived from the live Öhlins catalog.
 */
const OHLINS_CHASSIS_TO_MODEL: Record<string, Record<string, string>> = {
  BMW: {
    // M3 / M4 (single line — even E-series only had M3, but UX is cleaner with one entry)
    G80: 'M3 / M4', G82: 'M3 / M4', G81: 'M3 / M4', G83: 'M3 / M4',
    F80: 'M3 / M4', F82: 'M3 / M4', F83: 'M3 / M4',
    E90: 'M3 / M4', E91: 'M3 / M4', E92: 'M3 / M4', E93: 'M3 / M4',
    E46: 'M3 / M4', E36: 'M3 / M4', E30: 'M3 / M4',
    G87: 'M2', F87: 'M2',
    F90: 'M5', G90: 'M5', E60: 'M5',
    E81: '1 / 2-Series', E82: '1 / 2-Series', E87: '1 / 2-Series', E88: '1 / 2-Series',
    F22: '1 / 2-Series', F23: '1 / 2-Series', G42: '1 / 2-Series', F40: '1 / 2-Series',
    G20: '3-Series', G21: '3-Series', F30: '3-Series', F31: '3-Series',
    F34: '3-Series', F35: '3-Series',
    G22: '4-Series', G23: '4-Series', G26: '4-Series',
    G30: '5-Series', F10: '5-Series',
    G29: 'Z4', E89: 'Z4', E85: 'Z4',
  },
  Porsche: {
    '992': '911', '991': '911', '997': '911', '996': '911', '993': '911', '964': '911',
    '987': 'Cayman / Boxster / 718', '986': 'Cayman / Boxster / 718',
    '981': 'Cayman / Boxster / 718', '982': 'Cayman / Boxster / 718', '988': 'Cayman / Boxster / 718',
    '95B': 'Macan',
    '9YA': 'Cayenne', '92A': 'Cayenne', '9PA': 'Cayenne',
    '970': 'Panamera', '971': 'Panamera',
    'Y1A': 'Taycan',
  },
  'Mercedes-Benz': {
    W205: 'C63 AMG', W204: 'C63 AMG', W206: 'C63 AMG',
    W213: 'E63 AMG', W212: 'E63 AMG',
    W176: 'A45 AMG', W177: 'A45 AMG',
    C190: 'AMG GT', C192: 'AMG GT',
    C117: 'CLA45 AMG', C118: 'CLA45 AMG',
    W463: 'G-Class', W464: 'G-Class', W465: 'G-Class',
  },
  Audi: {
    '8V': 'RS3 / S3 / A3', '8Y': 'RS3 / S3 / A3', '8P': 'RS3 / S3 / A3',
    B7: 'RS4 / S4 / A4', B8: 'RS4 / S4 / A4 / RS5 / S5 / A5', B9: 'RS4 / S4 / A4 / RS5 / S5 / A5',
    C7: 'RS6 / RS7 / A6 / A7', C8: 'RS6 / RS7 / A6 / A7',
    '8S': 'TT / TTS / TTRS', '8J': 'TT / TTS / TTRS',
    '4S': 'R8', '42': 'R8',
  },
  Volkswagen: {
    MQB: 'Golf', PQ35: 'Golf', '5K': 'Golf', '5G': 'Golf',
    AW: 'Polo GTI', '6R': 'Polo GTI',
  },
  Toyota: {
    A90: 'GR Supra', A91: 'GR Supra',
    AN120: 'Hilux', AN130: 'Hilux',
    ZN6: 'GT86', ZN8: 'GR86',
  },
  Honda: {
    FK8: 'Civic Type R', FL5: 'Civic Type R', FN2: 'Civic Type R', EP3: 'Civic Type R', FK2: 'Civic Type R',
    AP1: 'S2000', AP2: 'S2000',
    NA1: 'NSX', NA2: 'NSX', NC1: 'NSX',
    DC2: 'Integra Type R', DC5: 'Integra Type R',
  },
  Subaru: {
    VA: 'WRX STI', VB: 'WRX STI', GE: 'WRX STI',
    GD: 'Impreza', GR: 'Impreza', GV: 'Impreza', GRB: 'Impreza',
    BP5: 'Legacy',
    ZC6: 'BRZ', ZD8: 'BRZ',
  },
  Nissan: {
    R35: 'GT-R', R34: 'GT-R', R33: 'GT-R', R32: 'GT-R', BNR34: 'Skyline GT-R',
    S15: 'Silvia', S14: 'Silvia', S13: 'Silvia',
    Z34: '370Z', Z33: '350Z', RZ34: 'Z',
  },
  Ford: {
    S550: 'Mustang', S650: 'Mustang',
    U704: 'Everest', UB: 'Everest',
  },
  Lotus: {
    // Lotus chassis are inconsistent in Öhlins titles — use textual fallback
  },
  Alpine: {
    AEF: 'A110',
  },
  Mini: {
    F55: 'Cooper / JCW', F56: 'Cooper / JCW', R56: 'Cooper / JCW', F60: 'Countryman', RE16: 'Cooper',
  },
  McLaren: {
    P13: '570S / 600LT', P14: '720S / 765LT',
  },
  Tesla: {},
  Suzuki: { GJ: 'Jimny' },
  Lexus: {
    USF40: 'LS', USF41: 'LS',
    XE10: 'IS', XE20: 'IS', XE30: 'IS', GSE2: 'IS',
  },
  Hyundai: { DN8: 'Sonata', PD: 'i30N', CN7: 'Elantra N' },
  Mazda: {
    NA: 'MX-5 / Miata', NB: 'MX-5 / Miata', NC: 'MX-5 / Miata', ND: 'MX-5 / Miata', RF: 'MX-5 / Miata',
    EC: 'MX-5 / Miata', NB8C: 'MX-5 / Miata',
    FD3S: 'RX-7', SE3P: 'RX-8',
  },
  Mitsubishi: {
    CN9A: 'Lancer Evo', CP9A: 'Lancer Evo', CT9A: 'Lancer Evo', CZ4A: 'Lancer Evo',
  },
  Jeep: {
    JK: 'Wrangler', JL: 'Wrangler', JT: 'Gladiator',
  },
  Isuzu: {},
  INEOS: {},
  Chevrolet: {},
  SEAT: {},
};

type TextualModelMatcher = {
  /** Display name shown in the dropdown */
  display: string;
  /** Substrings to look for in the upper-cased title */
  matches: string[];
};

const OHLINS_TEXTUAL_MODELS: Record<string, TextualModelMatcher[]> = {
  Tesla: [
    { display: 'Model 3', matches: ['MODEL 3'] },
    { display: 'Model Y', matches: ['MODEL Y'] },
    { display: 'Model S', matches: ['MODEL S'] },
    { display: 'Model X', matches: ['MODEL X'] },
  ],
  Toyota: [
    { display: 'GR Yaris', matches: ['YARIS GR', 'GR YARIS'] },
    { display: 'GR Corolla', matches: ['GR COROLLA'] },
  ],
  Honda: [
    { display: 'Civic Type R', matches: ['CIVIC TYPE-R', 'CIVIC TYPE R'] },
    { display: 'NSX', matches: ['NSX'] },
    { display: 'Integra Type R', matches: ['INTEGRA TYPE R', 'INTEGRA TYPE-R'] },
  ],
  Suzuki: [
    { display: 'Jimny', matches: ['JIMNY'] },
  ],
  Lotus: [
    { display: 'Elise', matches: ['ELISE'] },
    { display: 'Exige', matches: ['EXIGE'] },
    { display: 'Emira', matches: ['EMIRA'] },
    { display: 'Evora', matches: ['EVORA'] },
  ],
  McLaren: [
    { display: '570S / 600LT', matches: ['570S', '600LT'] },
    { display: '720S / 765LT', matches: ['720S', '765LT'] },
  ],
  Mitsubishi: [
    { display: 'Lancer Evo', matches: ['LANCER EVO', 'EVO X', 'EVO VII', 'EVO VIII', 'EVO IX', 'EVO 4', 'EVO 5', 'EVO 6', 'EVO 7', 'EVO 8', 'EVO 9', 'EVO 10'] },
  ],
  Hyundai: [
    { display: 'i30N', matches: ['I30N', 'I30 N'] },
  ],
  Lexus: [
    { display: 'IS', matches: ['IS 250', 'IS-F', 'IS250', 'IS300', 'IS350', 'IS-F'] },
  ],
  Mazda: [
    { display: 'MX-5 / Miata', matches: ['MX-5', 'MX5', 'MIATA'] },
    { display: 'RX-7', matches: ['RX-7', 'RX7'] },
    { display: 'RX-8', matches: ['RX-8', 'RX8'] },
  ],
  Subaru: [
    { display: 'BRZ', matches: ['BRZ'] },
    { display: 'Impreza', matches: ['IMPREZA'] },
    { display: 'WRX STI', matches: ['WRX STI', 'WRX'] },
    { display: 'Legacy', matches: ['LEGACY'] },
  ],
  Ford: [
    { display: 'Focus RS / ST', matches: ['FOCUS RS', 'FOCUS ST'] },
    { display: 'Mustang', matches: ['MUSTANG'] },
    { display: 'Ranger', matches: ['RANGER'] },
    { display: 'Everest', matches: ['EVEREST'] },
  ],
  Jeep: [
    { display: 'Wrangler', matches: ['WRANGLER'] },
    { display: 'Gladiator', matches: ['GLADIATOR'] },
  ],
  Isuzu: [
    { display: 'D-MAX', matches: ['D-MAX', 'DMAX'] },
    { display: 'MU-X', matches: ['MU-X', 'MUX'] },
  ],
  INEOS: [
    { display: 'Grenadier', matches: ['GRENADIER'] },
  ],
  Chevrolet: [
    { display: 'Camaro', matches: ['CAMARO'] },
  ],
  'Mercedes-Benz': [
    { display: 'A45 AMG', matches: ['A45'] },
    { display: 'C63 AMG', matches: ['C63'] },
    { display: 'E63 AMG', matches: ['E63'] },
    { display: 'CLA45 AMG', matches: ['CLA45'] },
    { display: 'AMG GT', matches: ['AMG GT', 'AMG-GT'] },
    { display: 'G-Class', matches: ['G63', 'G-CLASS', 'G CLASS'] },
  ],
};

/**
 * Extracts chassis codes that appear in a product title. Only returns codes
 * registered in OHLINS_CHASSIS_TO_MODEL[make] — guarantees clean output.
 */
function extractKnownChassis(title: string, make: string): string[] {
  const map = OHLINS_CHASSIS_TO_MODEL[make];
  if (!map) return [];
  const found = new Set<string>();
  const upperTitle = title.toUpperCase();
  for (const code of Object.keys(map)) {
    const re = new RegExp(`\\b${escapeRegex(code)}\\b`, 'i');
    if (re.test(upperTitle)) {
      found.add(code);
    }
  }
  return [...found];
}

/**
 * For makes whose models often appear as plain text (Tesla, Toyota GR-line),
 * detects the canonical model display name even when no chassis code is present.
 */
function extractTextualModels(title: string, make: string): string[] {
  const candidates = OHLINS_TEXTUAL_MODELS[make];
  if (!candidates) return [];
  const upperTitle = title.toUpperCase();
  const found = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.matches.some((m) => upperTitle.includes(m))) {
      found.add(candidate.display);
    }
  }
  return [...found];
}

const OHLINS_HERO_MAKE_PRIORITY = [
  'Porsche', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
  'Toyota', 'Honda', 'Subaru', 'Nissan', 'Ford',
  'Lotus', 'Mini', 'McLaren', 'Tesla', 'Alpine', 'Mazda',
  'Lexus', 'Hyundai', 'Suzuki', 'Mitsubishi', 'INEOS', 'Isuzu',
  'Volkswagen/Audi', 'Universal',
];

export type OhlinsHeroVehicleModel = {
  name: string;
  chassis: string[];
};
export type OhlinsHeroVehicleMake = {
  make: string;
  models: OhlinsHeroVehicleModel[];
};

/**
 * Tokens that MUST NOT be treated as chassis codes even if they look the part.
 * Mostly years, units of measurement, and trim qualifiers that show up inside
 * supplier title parentheses.
 */
const CHASSIS_TOKEN_BLACKLIST = new Set([
  // Years 1900-2099
  ...Array.from({ length: 200 }, (_, i) => String(1900 + i)),
  // Trim/spec qualifiers
  'GT', 'GT3', 'GT4', 'GTS', 'GTI', 'GTE', 'GTR', 'CSL', 'CS', 'RS', 'SS',
  'HP', 'KW', 'NM', 'EU', 'UK', 'US', 'JDM', 'EDM', 'USDM',
  'AWD', 'RWD', 'FWD', '4WD', '2WD',
  'DCT', 'MT', 'AT', 'CVT', 'AMT', 'PDK',
  'V6', 'V8', 'V10', 'V12',
  'TT', 'TTI', 'OPF', 'GPF', 'DPF',
  'OEM', 'ABS', 'PASM',
  'LWB', 'SWB', 'L1', 'L2',
  'PRE', 'POST', 'NEW', 'OLD',
  'TBC', 'TBD', 'EDC',
  'NA', // ambiguous: could be chassis (Mazda MX-5 NA) but also "naturally aspirated"; keep but warn
  // Door counts / body types
  'CABRIO', 'COUPE', 'SEDAN', 'WAGON', 'TOURER', 'TOURING',
]);

/**
 * Extracts all plausible chassis codes from parenthesised content in a title.
 * Examples:
 *   "BMW M3 (G80) / M4 (G82)"               → ['G80', 'G82']
 *   "Civic Type-R (FK8/FL5)"                → ['FK8', 'FL5']
 *   "Hilux 1\"lift (AN120/AN130)"           → ['AN120', 'AN130']
 *   "MX-5 (NA/NB) 1989–2005"                → ['NA', 'NB']
 *   "Cayman S / Cayman R (987) / Boxster (986/987)" → ['987', '986']
 */
function extractChassisFromParens(title: string): string[] {
  const found = new Set<string>();
  const parens = title.matchAll(/\(([^)]{1,80})\)/g);
  for (const m of parens) {
    const inside = m[1];
    // Split on common separators
    const tokens = inside.split(/[/,;]|\s+(?:and|та|or|и)\s+/i).map((t) => t.trim());
    for (const raw of tokens) {
      // Allow single-token chassis codes: 2-7 chars, mix of letters and digits
      const upper = raw.toUpperCase();
      if (!/^[A-Z0-9.\-]{2,7}$/.test(upper)) continue;
      // Must contain at least one digit OR be all-uppercase letters of length 2-4 (MQB, PQ35-style — but PQ35 has digit so handled)
      if (!/\d/.test(upper) && upper.length > 4) continue;
      // Exclude blacklist
      if (CHASSIS_TOKEN_BLACKLIST.has(upper)) continue;
      // Exclude pure numbers under 30 (likely a count, e.g. "8" pieces)
      if (/^\d{1,2}$/.test(upper)) continue;
      found.add(upper);
    }
  }
  return [...found];
}

/**
 * Strips every variant of Öhlins SKU prefix that appears at the start of supplier
 * titles. Atomic feed uses many formats:
 *   "OHLINS BMV GX11 Комплект..."
 *   "OHLINS 35020-03 Cancellation kit..."
 *   "OHLINS POR ... " / "OHLINS 24638-01 ..."
 */
function stripOhlinsTitlePrefix(title: string): string {
  return title
    // Brand + 2-4 letter family + alphanumeric SKU (e.g. "OHLINS BMV GX11")
    .replace(/^\s*(?:Ö|O)HLINS\s+[A-Z]{2,4}\s+[A-Z0-9-]{3,12}\s+/i, '')
    // Brand + numeric/dashed SKU (e.g. "OHLINS 35020-03")
    .replace(/^\s*(?:Ö|O)HLINS\s+\d{4,}-?\d{0,3}\s+/i, '')
    // Bare brand prefix (rare)
    .replace(/^\s*(?:Ö|O)HLINS\s+/i, '');
}

/**
 * Words that qualify a model variant (trim level, drivetrain, body style) —
 * stripped from extracted model names so "BMW M3 Competition xDrive" → "M3".
 */
const MODEL_QUALIFIER_RE = /^(Competition|Comp|Performance|Pure|Sport|Premium|Plus|Edition|Limited|Special|GTS|GTE|GTC|GTH|xDrive|sDrive|4Matic|4MATIC|Quattro|S-?Tronic|DCT|PDK|MT|AT|Convertible|Coupe|Sedan|Touring|Wagon|Estate|Hatchback|Cabrio|Cabriolet|Roadster|Targa|FR|RWD|AWD|FWD|Type-R|TypeR)$/i;

/**
 * Extracts a model name from a title — the text immediately following the make
 * name, up to the first chassis-paren or sentence break. Stops at chassis-like
 * tokens to avoid pulling chassis codes into the model name.
 */
function extractModelFromTitle(title: string, make: string): string | null {
  const stripped = stripOhlinsTitlePrefix(title);
  const makeRe = new RegExp(`\\b${escapeRegex(make)}\\b`, 'i');
  const m = makeRe.exec(stripped);
  if (!m) return null;

  // Take text after make name
  let after = stripped.slice(m.index + m[0].length).trim();

  // Cut at first chassis-paren or sentence break
  const cutChars = ['(', ',', '–', '—', '/', '|'];
  let cutIdx = after.length;
  for (const c of cutChars) {
    const i = after.indexOf(c);
    if (i > 0 && i < cutIdx) cutIdx = i;
  }
  after = after.slice(0, cutIdx).trim();

  // Tokenise and filter
  const tokens = after.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const raw of tokens) {
    const w = raw.replace(/[)"'.]+$/g, '').replace(/^[("']+/g, '');
    if (!w) continue;
    if (kept.length >= 3) break;
    // Stop at year
    if (/^(19|20)\d{2}/.test(w)) break;
    // Skip noise we never want in a model name
    if (/^OHLINS$/i.test(w)) break;
    // Skip qualifier (only if at least one word already kept)
    if (kept.length > 0 && MODEL_QUALIFIER_RE.test(w)) continue;
    // Skip standalone chassis-looking codes (G80, F87, A90, FK8) once we have a model
    if (kept.length > 0 && /^[A-Z]{1,3}\d{1,4}[A-Z]?$/.test(w.toUpperCase())) break;
    kept.push(w);
  }
  const result = kept.join(' ').trim();
  return result.length >= 1 ? result : null;
}

/**
 * Catalog-first builder. Scans every Öhlins product, assigns to a curated model
 * label using two strategies — chassis-code lookup and textual name match — and
 * collects only the chassis codes that actually appear in titles. Makes that
 * have products but no curated model match still appear in the dropdown
 * (model+chassis dropdowns disabled, submit goes straight to ?make=X).
 */
export function buildOhlinsHeroVehicleTree(
  products: ReadonlyArray<Pick<OhlinsCatalogProduct, 'slug' | 'title' | 'shortDescription'>>
): OhlinsHeroVehicleMake[] {
  // make → modelDisplayName → chassis Set
  const tree: Record<string, Record<string, Set<string>>> = {};
  // Track makes that have ≥1 product (even without resolvable model)
  const makesSeen = new Set<string>();

  for (const product of products) {
    const make = detectOhlinsMake(product);
    if (!make || make === 'Universal' || make === 'Volkswagen/Audi') continue;
    makesSeen.add(make);

    const title = `${product.title?.en ?? ''} ${product.title?.ua ?? ''}`;
    const chassisCodes = extractChassisFromParens(title);

    // Strategy 1 — chassis code maps to model (most reliable for makes with stable codes)
    const modelsFromChassis = new Set<string>();
    for (const code of chassisCodes) {
      const m = OHLINS_CHASSIS_TO_MODEL[make]?.[code];
      if (m) modelsFromChassis.add(m);
    }

    // Strategy 2 — textual model matcher (for makes without standardised chassis-in-paren format)
    const textualModels = new Set(extractTextualModels(title, make));

    const allModels = new Set<string>([...modelsFromChassis, ...textualModels]);
    if (allModels.size === 0) continue;

    if (!tree[make]) tree[make] = {};
    for (const model of allModels) {
      if (!tree[make][model]) tree[make][model] = new Set();
      // Attach chassis codes — only those that map to this exact model name
      const curatedForMake = OHLINS_CHASSIS_TO_MODEL[make] ?? {};
      for (const c of chassisCodes) {
        if (curatedForMake[c] === model) tree[make][model].add(c);
      }
    }
  }

  // Ensure every make seen in catalog appears in the dropdown, even without resolved models
  for (const make of makesSeen) {
    if (!tree[make]) tree[make] = {};
  }

  const result: OhlinsHeroVehicleMake[] = [];
  for (const [make, models] of Object.entries(tree)) {
    const modelArr = Object.entries(models)
      .map(([name, chassisSet]) => ({
        name,
        chassis: [...chassisSet].sort((a, b) => {
          if (a.length !== b.length) return b.length - a.length;
          return b.localeCompare(a);
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    result.push({ make, models: modelArr });
  }

  result.sort((a, b) => {
    const ai = OHLINS_HERO_MAKE_PRIORITY.indexOf(a.make);
    const bi = OHLINS_HERO_MAKE_PRIORITY.indexOf(b.make);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return result;
}

/**
 * Pulls every distinguishing token out of a curated model label so we can match
 * supplier titles that use any one of them. Examples:
 *   "GR Supra"          → ["GR SUPRA", "GR", "SUPRA"]
 *   "M3 / M4"           → ["M3", "M4"]
 *   "Civic Type R"      → ["CIVIC TYPE R", "TYPE R", "CIVIC"]
 *   "718 / Cayman / Boxster" → ["718", "CAYMAN", "BOXSTER"]
 */
function buildModelMatchTokens(modelName: string): string[] {
  const tokens = new Set<string>();
  const variants = modelName
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const variant of variants) {
    const upper = variant.toUpperCase();
    tokens.add(upper);
    // Also add individual significant words so "GR Supra" matches "SUPRA"-only titles
    const words = upper.split(/\s+/).filter((w) => w.length >= 2 && /[A-Z0-9]/.test(w));
    for (const w of words) tokens.add(w);
    // For multi-word names, add tail substring (e.g. "Civic Type R" → "TYPE R")
    if (words.length >= 2) {
      tokens.add(words.slice(-2).join(' '));
    }
  }
  return [...tokens];
}

/**
 * Validates whether the catalog has at least one Öhlins product matching the
 * cascade Make → Model → Chassis (chassis optional). Used to prune the hero
 * filter dropdowns so users never get redirected to an empty result page.
 */
export function ohlinsCascadeHasProducts(
  products: ReadonlyArray<Pick<OhlinsCatalogProduct, 'slug' | 'title' | 'shortDescription'>>,
  make: string,
  modelName: string | null,
  chassis: string | null
): boolean {
  const modelTokens = modelName ? buildModelMatchTokens(modelName) : null;
  const chassisRe = chassis ? new RegExp(`\\b${escapeRegex(chassis)}\\b`, 'i') : null;

  return products.some((p) => {
    if (detectOhlinsMake(p) !== make) return false;
    const title = `${p.title?.en ?? ''} ${p.title?.ua ?? ''}`.toUpperCase();
    if (chassisRe && !chassisRe.test(title)) return false;
    if (modelTokens && !modelTokens.some((token) => title.includes(token))) return false;
    return true;
  });
}

/**
 * Per-title cascade matcher. Returns true when the title plausibly matches the
 * given model name and chassis code. Make filtering is done separately (via
 * `detectOhlinsMake`) because it takes a full product, not just a title.
 */
export function matchesOhlinsModelChassis(
  title: string,
  modelName: string | null,
  chassis: string | null
): boolean {
  const upperTitle = title.toUpperCase();
  if (chassis) {
    const re = new RegExp(`\\b${escapeRegex(chassis)}\\b`, 'i');
    if (!re.test(upperTitle)) return false;
  }
  if (modelName) {
    const tokens = buildModelMatchTokens(modelName);
    if (!tokens.some((token) => upperTitle.includes(token))) return false;
  }
  return true;
}
