/**
 * Per-chassis coverage check. For each (model, chassis) entry exposed in the
 * vehicle filter (do88FitmentData.CAR_DATA), do two things:
 *
 *   1. Hit the corresponding EU category page on do88performance.eu and list
 *      every SKU on it (live source of truth).
 *   2. Query our DB for products whose `categoryEn` ends with the chassis's
 *      categoryToken — that's what the filter actually surfaces today.
 *
 * Then diff: which SKUs DO88 sells for this chassis but we don't carry, and
 * vice versa. The output makes it obvious whether the picker is feeding from
 * a complete catalog or whether we have gaps to import.
 */

import { PrismaClient } from '@prisma/client';
import https from 'https';

const COOKIE = 'VALUTA=EUR; SPRAK=EN';
const BASE = 'https://www.do88performance.eu';

type ChassisProbe = {
  brand: string;
  model: string;
  chassis: string;
  // categoryTokens we use in code to match products
  categoryTokens: string[];
  // EU page URLs to crawl for this chassis (multiple — hose-kits AND
  // engine-tuning often split products across several roots).
  euUrls: string[];
};

// URLs are paths discovered live by walking /en/artiklar/hose-kits/<brand>/.
// Some of the engine-tuning sub-pages (intercoolers, intakes) are also worth
// crawling per chassis — they expose the high-value SKUs (ICM, LF, MK, WC)
// that don't ship under hose-kits. We list them as additional URLs per probe.
const PROBES: ChassisProbe[] = [
  { brand: 'Porsche', model: '911 Turbo / Turbo S', chassis: '992',
    categoryTokens: ['992.1, Turbo (911)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/porsche/992-turbo/index.html`] },
  { brand: 'Porsche', model: '911 Carrera', chassis: '992',
    categoryTokens: ['992.1, Carrera (911)'],
    euUrls: [
      `${BASE}/en/artiklar/hose-kits/porsche/9921/index.html`,
      `${BASE}/en/artiklar/hose-kits/porsche/9922-carrera-911/index.html`,
    ] },
  { brand: 'Porsche', model: '911 Turbo', chassis: '991',
    categoryTokens: ['991.1, Turbo (911)', '991.2, Turbo (911)'],
    euUrls: [
      `${BASE}/en/artiklar/hose-kits/porsche/991/index.html`,
      `${BASE}/en/artiklar/hose-kits/porsche/9912/index.html`,
    ] },
  { brand: 'Porsche', model: '911 Carrera', chassis: '991',
    categoryTokens: ['991.2, Carrera (911)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/porsche/9912-carrera-t-911/index.html`] },
  { brand: 'Porsche', model: '911 Turbo', chassis: '997',
    categoryTokens: ['997.1, Turbo GT2 (911)', '997.2, Turbo (911)'],
    euUrls: [
      `${BASE}/en/artiklar/hose-kits/porsche/9971/index.html`,
      `${BASE}/en/artiklar/hose-kits/porsche/9972/index.html`,
    ] },
  { brand: 'BMW', model: 'M2 / M3 / M4', chassis: 'G80 G82 G87',
    categoryTokens: ['G80 G87, S58 (M2 M3 M4)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/bmw/g80-g87-s58-m2-m3-m4/index.html`] },
  { brand: 'BMW', model: 'M3 / M4', chassis: 'F80 F82',
    categoryTokens: ['F80 F82 F87, S55 (M2C M3 M4)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/bmw/f8x-m2c-m3-m4/index.html`] },
  { brand: 'BMW', model: 'M2', chassis: 'F87',
    categoryTokens: ['F87, N55B30T0 (M2)', 'F80 F82 F87, S55 (M2C M3 M4)'],
    euUrls: [
      `${BASE}/en/artiklar/hose-kits/bmw/f8x-m2c-m3-m4/index.html`,
      `${BASE}/en/artiklar/hose-kits/bmw/f20-f30-f87/index.html`,
    ] },
  { brand: 'BMW', model: 'M340i / M440i / Z4 M40i', chassis: 'G20 G22 G29',
    categoryTokens: ['G-Chassis, B58 Gen 2'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/bmw/g20-g29-g42/index.html`] },
  { brand: 'Audi', model: 'RS6 / RS7', chassis: 'C8',
    categoryTokens: ['RS6 RS7, 4.0 V8 TFSI (C8)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/audi/rs6-rs7-40-v8-tfsi-c8/index.html`] },
  { brand: 'Audi', model: 'RS3 / TTRS', chassis: '8V 8Y',
    categoryTokens: ['RS3 TT RS, 2.5 TFSI (8V 8Y 8S)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/audi/rs3/index.html`] },
  { brand: 'Audi', model: 'A3 / S3', chassis: '8V 8Y',
    categoryTokens: ['A3 S3 TT, 2.0 TFSI EA888 (8V 8S)'],
    euUrls: [
      `${BASE}/en/artiklar/hose-kits/audi/a3-s3-8v-12-tt-8s-15-/index.html`,
      `${BASE}/en/artiklar/hose-kits/audi/a3-s3-8y-21-/index.html`,
    ] },
  { brand: 'VW', model: 'Golf GTI / R', chassis: 'Mk8',
    categoryTokens: ['Golf, 2.0T EA888 Gen 4 (Mk 8 MQB Evo)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/vw/golf-mk-8/index.html`] },
  { brand: 'VW', model: 'Golf GTI / R', chassis: 'Mk7',
    categoryTokens: ['Golf, 1.8T / 2.0T EA888 (Mk 7/7.5 MQB)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/vw/golf-mk-7-mk-75-mqb-13-19/index.html`] },
  { brand: 'Toyota', model: 'GR Supra', chassis: 'A90',
    categoryTokens: ['GR Supra, 3.0T B58 (MK5)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/toyota-2/gr-supra-a90/index.html`] },
  { brand: 'Toyota', model: 'GR Yaris', chassis: 'GXPA16',
    categoryTokens: ['GR Yaris, 1.6T G16E-GTS (GXPA16)'],
    euUrls: [`${BASE}/en/artiklar/hose-kits/toyota-2/gr-yaris/index.html`] },
];

function fetchPage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'OneCompany-DO88-Verify/1.0', Cookie: COOKIE } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Off-domain redirect (drops cookie) — treat as 404 for our purpose
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) { resolve(null); return; }
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
        res.on('error', () => resolve(null));
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

function extractSkusFromCategoryHtml(html: string): Set<string> {
  const skus = new Set<string>();
  const wrapperRe = /<div class="PT_Wrapper[\s\S]*?(?=<div class="PT_Wrapper |<\/div>\s*<div class="PT_Wrapper_All|<div class="row paging|<div id="result_artiklar)/g;
  const blocks = html.match(wrapperRe) || [];
  for (const block of blocks) {
    const skuM = block.match(/"altnr"\s*:\s*"([^"]+)"/);
    if (skuM) skus.add(skuM[1]);
  }
  return skus;
}

function normalizeSku(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/^do88-/, '');
}

async function main() {
  const prisma = new PrismaClient();
  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'DO88', mode: 'insensitive' } },
    select: { sku: true, slug: true, titleEn: true, categoryEn: true, isPublished: true },
  });
  await prisma.$disconnect();

  console.log(`📥 DB total DO88 products: ${dbProducts.length}\n`);

  const reports: Array<{
    brand: string; model: string; chassis: string;
    euCount: number; euSkus: string[];
    dbCount: number;
    inEuNotInDb: string[];
    inDbNotInEu: Array<{ sku: string; title: string }>;
    failedUrls: string[];
  }> = [];

  for (const probe of PROBES) {
    const euSkus = new Set<string>();
    const failedUrls: string[] = [];
    for (const url of probe.euUrls) {
      const html = await fetchPage(url);
      if (!html) { failedUrls.push(url); continue; }
      for (const s of extractSkusFromCategoryHtml(html)) euSkus.add(s);
    }

    // DB matches: products whose categoryEn ends-with any token
    const dbMatches = dbProducts.filter((p) => {
      const cat = p.categoryEn ?? '';
      return probe.categoryTokens.some((t) => cat.endsWith(t) || cat.includes(`> ${t}`));
    });

    const dbSkuSet = new Set(dbMatches.map((p) => normalizeSku(p.sku)));
    const euSkuNorm = [...euSkus].map(normalizeSku);

    const inEuNotInDb = euSkuNorm.filter((s) => !dbSkuSet.has(s));
    const inDbNotInEu = dbMatches
      .filter((p) => !euSkuNorm.includes(normalizeSku(p.sku)))
      .map((p) => ({ sku: p.sku ?? '', title: p.titleEn ?? '' }));

    reports.push({
      brand: probe.brand,
      model: probe.model,
      chassis: probe.chassis,
      euCount: euSkus.size,
      euSkus: [...euSkus],
      dbCount: dbMatches.length,
      inEuNotInDb,
      inDbNotInEu,
      failedUrls,
    });
  }

  // Print report
  console.log('Brand   Model                          Chassis           EU   DB   missing-from-DB');
  console.log('─'.repeat(95));
  for (const r of reports) {
    const missing = r.inEuNotInDb.length;
    const flag = missing > 0 ? ` ❗${missing}` : ' ✓';
    console.log(
      `${r.brand.padEnd(8)}${r.model.padEnd(31)}${r.chassis.padEnd(18)}${String(r.euCount).padStart(4)} ${String(r.dbCount).padStart(4)}${flag}`
    );
  }

  console.log('\n--- Per-chassis details (only chassis with gaps) ---');
  for (const r of reports) {
    if (r.inEuNotInDb.length === 0 && r.inDbNotInEu.length === 0 && r.failedUrls.length === 0) continue;
    console.log(`\n${r.brand} ${r.model} (${r.chassis})`);
    if (r.failedUrls.length) console.log(`  ⚠️ failed URLs: ${r.failedUrls.length}`);
    if (r.inEuNotInDb.length) {
      console.log(`  ❗ ${r.inEuNotInDb.length} on EU site not in DB:`);
      r.inEuNotInDb.forEach((s) => console.log(`    - ${s}`));
    }
    if (r.inDbNotInEu.length) {
      console.log(`  ⚠️ ${r.inDbNotInEu.length} in DB but not on this EU page (may be split across categories or delisted):`);
      r.inDbNotInEu.slice(0, 10).forEach((p) => console.log(`    - ${p.sku} | ${p.title.slice(0, 65)}`));
      if (r.inDbNotInEu.length > 10) console.log(`    ... +${r.inDbNotInEu.length - 10} more`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
