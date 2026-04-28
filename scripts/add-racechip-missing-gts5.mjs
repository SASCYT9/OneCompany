import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const REPORT_FILE = path.join(ROOT, '.tmp', 'racechip-missing-gts5-audit.json');
const PRODUCTS_FILE = path.join(ROOT, 'data', 'racechip-products.json');
const PROGRESS_FILE = path.join(ROOT, 'data', 'racechip-progress.json');
const GENERATED_FILE = path.join(ROOT, 'src', 'lib', 'racechipMissingGts5.generated.ts');
const CACHE_DIR = path.join(ROOT, '.tmp', 'racechip-reader-cache');

const RACECHIP_IMAGES = [
  'https://www.racechip.eu/media/wysiwyg/product_overlay/gts-black-three-quarter.png',
  'https://www.racechip.eu/media/wysiwyg/pdp_images/product-black-connect.png',
  'https://www.racechip.eu/media/wysiwyg/pdp_images/product-gts_shop.png',
];

const MANUAL_ROWS = [
  {
    url: 'https://www.racechip.eu/shop/bmw/x6-g06-from-2019/30-d-mild-hybrid-2993ccm-298hp-219kw-650nm.html',
    makeSlug: 'bmw',
    modelSlug: 'x6-g06-from-2019',
    engineSlug: '30-d-mild-hybrid-2993ccm-298hp-219kw-650nm',
    engineName: '30-d-mild-hybrid',
    ccm: 2993,
    baseHp: 298,
    baseKw: 219,
    baseNm: 650,
    gainHp: 42,
    gainNm: 54,
    priceEur: 739,
  },
];

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMake(slug) {
  const special = {
    bmw: 'BMW',
    vw: 'Volkswagen',
    'mercedes-benz': 'Mercedes-Benz',
    'alfa-romeo': 'Alfa Romeo',
    'land-rover': 'Land Rover',
    ds: 'DS',
    mini: 'MINI',
    kia: 'Kia',
    ssangyong: 'SsangYong',
    ldv: 'LDV',
    mclaren: 'McLaren',
  };
  return special[slug] ?? slug.split('-').map(capitalize).join(' ');
}

function formatModel(slug) {
  return slug
    .replace(/-?from-\d{4}/, '')
    .replace(/-?\d{4}-to-\d{4}/, '')
    .replace(/^-|-$/g, '')
    .split('-')
    .map((part) => {
      if (/^[a-z]\d+$/i.test(part) || /^\d+$/.test(part) || part.length <= 3) {
        return part.toUpperCase();
      }
      return capitalize(part);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatEngine(slug) {
  return slug
    .replace(/(\d+)-(\d+)/, '$1.$2')
    .replace(/-/g, ' ')
    .replace(/(\d+)ccm.*/, '$1cc')
    .toUpperCase()
    .trim();
}

function buildTitle(row) {
  return `RaceChip GTS 5 — ${formatMake(row.make)} ${formatModel(row.model)} ${formatEngine(row.engine)}`.trim();
}

function slugifyUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 180);
}

function parseNumber(value) {
  return Number(String(value).replace(/\./g, '').replace(',', '.'));
}

function parsePrices(text) {
  return [...text.matchAll(/(\d[\d.,]*)\s*EUR/gi)]
    .map((match) => parseNumber(match[1]))
    .filter((value) => value > 100 && value < 2500);
}

function getGts5Window(body) {
  const productCardIndex = body.search(/RaceChip GTS 5 Black control unit/i);
  const selectorIndex = body.search(/\|\s*\[RaceChip GTS 5 Black\]/i);
  const looseIndex = body.search(/RaceChip GTS 5 Black\s+\+|\[RaceChip GTS 5 Black\]/i);
  const index = productCardIndex >= 0 ? productCardIndex : selectorIndex >= 0 ? selectorIndex : looseIndex;
  if (index < 0) {
    return '';
  }

  const endMarkers = [
    'Noticeable Increased performance',
    'Powerful Performance boost',
    'All Features',
    'By choosing RaceChip GTS 5 Black',
    'Optimized ',
  ];
  const endIndex = Math.min(
    ...endMarkers
      .map((marker) => body.indexOf(marker, index))
      .filter((markerIndex) => markerIndex > index)
  );

  return body.slice(index, Number.isFinite(endIndex) ? endIndex : undefined);
}

function resolveRegularPricingFromCache(row) {
  const cachePath = path.join(CACHE_DIR, `${slugifyUrl(row.url)}.md`);
  if (!fs.existsSync(cachePath)) {
    return row;
  }

  const windowText = getGts5Window(fs.readFileSync(cachePath, 'utf8'));
  if (!windowText) {
    return row;
  }

  const compactWindow = windowText.replace(/\s+/g, ' ');
  const specialMatch = compactWindow.match(
    /Special price!\s*(\d[\d.,]*)\s+(\d[\d.,]*)\s*EUR/i
  );
  if (specialMatch) {
    return {
      ...row,
      priceEur: parseNumber(specialMatch[1]),
      salePriceEur: parseNumber(specialMatch[2]),
    };
  }

  const prices = parsePrices(windowText);
  return prices.length ? { ...row, priceEur: Math.max(...prices) } : row;
}

function normalizeRows(rows) {
  const byUrl = new Map();
  for (const row of rows) {
    const makeSlug = row.makeSlug ?? row.make;
    const modelSlug = row.modelSlug ?? row.model;
    const engineSlug = row.engineSlug ?? row.engine;
    const baseHp = row.baseHp ?? row.hp;
    const baseKw = row.baseKw ?? row.kw;
    const baseNm = row.baseNm ?? row.nm;

    if (!row.url || !makeSlug || !modelSlug || !engineSlug) {
      continue;
    }
    if (!row.priceEur || !row.gainHp || !row.gainNm || !baseHp || !baseKw || !baseNm || !row.ccm) {
      continue;
    }
    const normalizedRow = resolveRegularPricingFromCache({
      url: row.url,
      makeSlug,
      modelSlug,
      engineSlug,
      engineName: row.engineName,
      ccm: row.ccm,
      baseHp,
      baseKw,
      baseNm,
      gainHp: row.gainHp,
      gainNm: row.gainNm,
      priceEur: row.priceEur,
      ...(row.salePriceEur ? { salePriceEur: row.salePriceEur } : {}),
    });
    byUrl.set(row.url, normalizedRow);
  }

  return Array.from(byUrl.values()).sort((a, b) =>
    [a.makeSlug, a.modelSlug, a.engineSlug].join('/').localeCompare(
      [b.makeSlug, b.modelSlug, b.engineSlug].join('/')
    )
  );
}

function toScrapedProduct(row, timestamp) {
  return {
    url: row.url,
    makeSlug: row.makeSlug,
    modelSlug: row.modelSlug,
    engineSlug: row.engineSlug,
    title: buildTitle({
      make: row.makeSlug,
      model: row.modelSlug,
      engine: row.engineSlug,
    }),
    selectedTier: 'GTS 5',
    hasAppControl: true,
    priceGTS5: row.priceEur,
    priceAppControl: 0,
    priceEUR: row.priceEur,
    baseHp: row.baseHp,
    baseKw: row.baseKw,
    baseNm: row.baseNm,
    ccm: row.ccm,
    gainHp: row.gainHp,
    gainNm: row.gainNm,
    images: RACECHIP_IMAGES,
    timestamp,
  };
}

function writeGeneratedRows(rows) {
  const header = `// Generated by scripts/add-racechip-missing-gts5.mjs from .tmp/racechip-missing-gts5-audit.json.
// Keep this file deterministic; rerun the script after updating the audit.

export type RacechipMissingGts5Row = {
  url: string;
  makeSlug: string;
  modelSlug: string;
  engineSlug: string;
  engineName: string;
  ccm: number;
  baseHp: number;
  baseKw: number;
  baseNm: number;
  gainHp: number;
  gainNm: number;
  priceEur: number;
  salePriceEur?: number;
};

`;
  const body = `export const RACECHIP_MISSING_GTS5_ROWS = ${JSON.stringify(
    rows,
    null,
    2
  )} as const satisfies readonly RacechipMissingGts5Row[];
`;

  fs.writeFileSync(GENERATED_FILE, header + body, 'utf8');
}

if (!fs.existsSync(REPORT_FILE)) {
  throw new Error(`Missing audit file: ${REPORT_FILE}`);
}

const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
const rows = normalizeRows(report.missingGts5 ?? []);
report.missingGts5 = rows.map((row) => ({
  make: row.makeSlug,
  model: row.modelSlug,
  engine: row.engineSlug,
  engineName: row.engineName,
  ccm: row.ccm,
  hp: row.baseHp,
  kw: row.baseKw,
  nm: row.baseNm,
  url: row.url,
  gainHp: row.gainHp,
  gainNm: row.gainNm,
  priceEur: row.priceEur,
  ...(row.salePriceEur ? { salePriceEur: row.salePriceEur } : {}),
}));
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const dataRows = normalizeRows([...MANUAL_ROWS, ...rows]);
const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
const existingUrls = new Set(products.map((product) => product.url));
const timestamp = new Date().toISOString();
const rowsByUrl = new Map(dataRows.map((row) => [row.url, row]));
let updatedProducts = 0;
for (let i = 0; i < products.length; i += 1) {
  const row = rowsByUrl.get(products[i].url);
  if (row) {
    products[i] = toScrapedProduct(row, products[i].timestamp ?? timestamp);
    updatedProducts += 1;
  }
}
const additions = dataRows
  .filter((row) => !existingUrls.has(row.url))
  .map((row) => toScrapedProduct(row, timestamp));

if (additions.length > 0) {
  products.push(...additions);
}
if (additions.length > 0 || updatedProducts > 0) {
  fs.writeFileSync(PRODUCTS_FILE, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
}

const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
const crawled = new Set(Array.isArray(progress.crawled) ? progress.crawled : []);
dataRows.forEach((row) => crawled.add(row.url));
progress.crawled = Array.from(crawled);
if (Array.isArray(progress.pending)) {
  const rowUrls = new Set(dataRows.map((row) => row.url));
  progress.pending = progress.pending.filter((url) => !rowUrls.has(url));
}
fs.writeFileSync(PROGRESS_FILE, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
writeGeneratedRows(rows);

console.log(
  JSON.stringify(
    {
      auditRows: rows.length,
      updatedProducts,
      addedProducts: additions.length,
      generatedFile: path.relative(ROOT, GENERATED_FILE),
    },
    null,
    2
  )
);
