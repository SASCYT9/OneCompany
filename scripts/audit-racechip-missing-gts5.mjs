import fs from 'fs';
import https from 'https';
import path from 'path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'racechip-products.json');
const OUT_FILE = path.join(ROOT, '.tmp', 'racechip-missing-gts5-audit.json');
const CACHE_DIR = path.join(ROOT, '.tmp', 'racechip-reader-cache');
const USER_AGENT = 'Mozilla/5.0 OneCompany RaceChip audit';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || '1'];
  })
);

const onlyMakes = String(args.get('makes') ?? args.get('make') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const maxPages = Number(args.get('max') ?? 0) || Infinity;
const offset = Number(args.get('offset') ?? 0) || 0;
const delayMs = Number(args.get('delay') ?? 1200) || 1200;
const includePattern = args.has('include') ? new RegExp(String(args.get('include')), 'i') : null;
const force = args.has('force');

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugifyUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 180);
}

function request(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body });
        });
      })
      .on('error', (error) => {
        resolve({ status: 0, body: '', error: error.message });
      });
  });
}

async function readUrl(url) {
  const cachePath = path.join(CACHE_DIR, `${slugifyUrl(url)}.md`);
  if (fs.existsSync(cachePath)) {
    return { status: 200, body: fs.readFileSync(cachePath, 'utf8'), cached: true };
  }

  const readerUrl = `https://r.jina.ai/http://${url}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await request(readerUrl);
    if (result.status === 200 && result.body) {
      fs.writeFileSync(cachePath, result.body, 'utf8');
      return { ...result, cached: false };
    }
    if (result.status === 429) {
      await sleep(10_000 + attempt * 10_000);
      continue;
    }
    return result;
  }

  return { status: 429, body: '', error: 'reader rate limited after retries' };
}

function parseProductUrl(url) {
  const shopPart = url.split('/shop/')[1]?.replace(/\.html$/, '');
  const parts = shopPart?.split('/') ?? [];
  const engine = parts[2] ?? '';
  const match = engine.match(/^(.+?)-(\d+)ccm-(\d+)hp-(\d+)kw-(\d+)nm$/);

  return {
    make: parts[0] ?? '',
    model: parts[1] ?? '',
    engine,
    engineName: match?.[1] ?? '',
    ccm: Number(match?.[2] ?? 0),
    hp: Number(match?.[3] ?? 0),
    kw: Number(match?.[4] ?? 0),
    nm: Number(match?.[5] ?? 0),
  };
}

function parsePrice(text) {
  const prices = [...text.matchAll(/(\d[\d.,]*)\s*EUR/gi)]
    .map((match) => Number(match[1].replace(/\./g, '').replace(',', '.')))
    .filter((value) => value > 100 && value < 2500);

  return {
    first: prices[0] ?? 0,
    max: prices.length ? Math.max(...prices) : 0,
    all: prices,
  };
}

function parseRacechipNumber(value) {
  return Number(String(value).replace(/\./g, '').replace(',', '.'));
}

function parseGts5(body) {
  const productCardIndex = body.search(/RaceChip GTS 5 Black control unit/i);
  const selectorIndex = body.search(/\|\s*\[RaceChip GTS 5 Black\]/i);
  const looseIndex = body.search(/RaceChip GTS 5 Black\s+\+|\[RaceChip GTS 5 Black\]/i);
  const index = productCardIndex >= 0 ? productCardIndex : selectorIndex >= 0 ? selectorIndex : looseIndex;
  if (index < 0) {
    return { hasGts5: false, gainHp: 0, gainNm: 0, priceEur: 0 };
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
  const windowText = body.slice(index, Number.isFinite(endIndex) ? endIndex : undefined);
  const compactWindow = windowText.replace(/\s+/g, ' ');
  const gainHp = Math.max(0, ...[...compactWindow.matchAll(/\+\s*(\d+)\s*HP/gi)].map((match) => Number(match[1])));
  const gainNm = Math.max(0, ...[...compactWindow.matchAll(/\+\s*(\d+)\s*Nm/gi)].map((match) => Number(match[1])));
  const specialMatch = compactWindow.match(/Special price!\s*(\d[\d.,]*)\s+(\d[\d.,]*)\s*EUR/i);
  const regularSpecialPrice = specialMatch ? parseRacechipNumber(specialMatch[1]) : 0;
  const saleSpecialPrice = specialMatch ? parseRacechipNumber(specialMatch[2]) : 0;
  const prices = parsePrice(windowText);
  const hasConcreteGains = gainHp > 0 || gainNm > 0;
  const hasConcretePrice = prices.first > 0 || prices.max > 0;

  return {
    hasGts5: hasConcreteGains || hasConcretePrice,
    gainHp,
    gainNm,
    priceEur: regularSpecialPrice || prices.max || prices.first || saleSpecialPrice,
    salePriceEur: saleSpecialPrice,
  };
}

function unique(values) {
  return [...new Set(values)];
}

function loadExistingReport() {
  if (!fs.existsSync(OUT_FILE)) {
    return {
      generatedAt: null,
      checked: {},
      missingGts5: [],
      noGts5: [],
      errors: [],
    };
  }
  return JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
}

function saveReport(report) {
  report.generatedAt = new Date().toISOString();
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), 'utf8');
}

const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const productUrls = new Set(products.map((product) => product.url));
const makes = onlyMakes.length ? onlyMakes : unique(products.map((product) => product.makeSlug)).sort();
const report = loadExistingReport();

const brandPages = [];
for (const make of makes) {
  const brandUrl = `https://www.racechip.eu/chip-tuning/${make}.html`;
  const page = await readUrl(brandUrl);
  if (page.status !== 200) {
    report.errors.push({ type: 'brand-page', make, url: brandUrl, status: page.status, error: page.error ?? null });
    continue;
  }

  const productRegex = new RegExp(
    `https:\\/\\/www\\.racechip\\.eu\\/shop\\/${make}\\/[^\\)\\]\\s]+?\\.html`,
    'g'
  );
  const urls = unique([...page.body.matchAll(productRegex)].map((match) => match[0].replace(/\.html\.html$/, '.html')))
    .filter((url) => new RegExp(`/shop/${make}/[^/]+/[^/]+\\.html$`).test(url));
  const missingUrls = urls.filter((url) => !productUrls.has(url));

  brandPages.push({
    make,
    total: urls.length,
    missing: missingUrls.length,
    missingUrls,
  });
}

const candidates = brandPages
  .flatMap((entry) => entry.missingUrls.map((url) => ({ make: entry.make, url })))
  .filter((entry) => !includePattern || includePattern.test(entry.url))
  .filter((entry) => force || !report.checked[entry.url])
  .slice(offset, Number.isFinite(maxPages) ? offset + maxPages : undefined);

console.log(
  JSON.stringify(
    {
      makes: brandPages.length,
      candidatesThisRun: candidates.length,
      alreadyChecked: Object.keys(report.checked).length,
      brandPages: brandPages
        .filter((entry) => entry.missing > 0)
        .sort((a, b) => b.missing - a.missing)
        .map(({ make, total, missing }) => ({ make, total, missing })),
    },
    null,
    2
  )
);

for (let i = 0; i < candidates.length; i += 1) {
  const candidate = candidates[i];
  const page = await readUrl(candidate.url);
  const base = parseProductUrl(candidate.url);

  if (page.status !== 200) {
    const error = { type: 'product-page', ...base, url: candidate.url, status: page.status, error: page.error ?? null };
    report.errors.push(error);
    report.checked[candidate.url] = { status: 'error', at: new Date().toISOString() };
    saveReport(report);
    await sleep(delayMs);
    continue;
  }

  const gts5 = parseGts5(page.body);
  if (gts5.hasGts5) {
    const row = {
      ...base,
      url: candidate.url,
      gainHp: gts5.gainHp,
      gainNm: gts5.gainNm,
      priceEur: gts5.priceEur,
      ...(gts5.salePriceEur ? { salePriceEur: gts5.salePriceEur } : {}),
    };
    const existingIndex = report.missingGts5.findIndex((item) => item.url === candidate.url);
    if (existingIndex >= 0) {
      report.missingGts5[existingIndex] = row;
    } else {
      report.missingGts5.push(row);
    }
    report.noGts5 = report.noGts5.filter((url) => url !== candidate.url);
    report.checked[candidate.url] = { status: 'missing-gts5', at: new Date().toISOString() };
  } else {
    if (!report.noGts5.includes(candidate.url)) {
      report.noGts5.push(candidate.url);
    }
    report.checked[candidate.url] = { status: 'no-gts5', at: new Date().toISOString() };
  }

  if ((i + 1) % 10 === 0 || i + 1 === candidates.length) {
    saveReport(report);
    console.log(
      `checked ${i + 1}/${candidates.length}; missing GTS5 ${report.missingGts5.length}; errors ${report.errors.length}`
    );
  }

  await sleep(delayMs);
}

saveReport(report);
console.log(`Audit report written to ${OUT_FILE}`);
