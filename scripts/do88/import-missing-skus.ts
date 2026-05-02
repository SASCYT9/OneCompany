/**
 * Import the do88 SKUs we identified as missing from our DB versus what
 * do88performance.eu currently sells under the chassis we expose in the
 * vehicle filter.
 *
 * Hardcoded list — derived from
 * `scripts/do88/verify-chassis-coverage.ts` output. Each entry locks down:
 *   - the exact `categoryEn` we want the product to live under (must match a
 *     `categoryToken` from `do88FitmentData.ts` so the picker surfaces it),
 *   - the collection card it should be grouped into on the homepage,
 *   - the EU detail page to scrape title / description / image from.
 *
 * Defaults to dry-run; pass --apply to insert.
 *
 * UA fields are left equal to the EN ones — these are new products without a
 * polished translation yet, and the project policy from
 * `minimal_reimport.md` is to never let JSON-side imports overwrite curated
 * UA copy. We're inserting new rows, not overwriting, so this is safe.
 */

import { PrismaClient } from '@prisma/client';
import https from 'https';
import fs from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const COOKIE = 'VALUTA=EUR; SPRAK=EN';
const BASE = 'https://www.do88performance.eu';
const SCRAPED = path.join(process.cwd(), 'scripts/do88/scraped/do88-eu-prices.json');

type CollectionEn =
  | 'Intercoolers' | 'Radiators' | 'Intake Systems'
  | 'Performance Hoses' | 'Oil Coolers' | 'Y-Pipes & Plenums'
  | 'Fans & Accessories' | 'Performance Parts' | 'Air Filters';

const collectionUkMap: Record<CollectionEn, string> = {
  'Intercoolers': 'Інтеркулери',
  'Radiators': 'Радіатори',
  'Intake Systems': 'Системи впуску',
  'Performance Hoses': 'Патрубки',
  'Oil Coolers': 'Масляні радіатори',
  'Y-Pipes & Plenums': 'Y-Пайпи та Пленуми',
  'Fans & Accessories': 'Вентилятори та аксесуари',
  'Performance Parts': 'Деталі',
  'Air Filters': 'Повітряні фільтри',
};

type ImportEntry = {
  sku: string;
  /** Where the picker should pick it up. Must match a chassis token from CAR_DATA. */
  categoryEn: string;
  collectionEn: CollectionEn;
  /** Pre-existing detail page URL on do88performance.eu. */
  detailUrl: string;
  /** Tags to help with cross-shop fitment / search. */
  tags: string[];
};

// Two truly new entries (rest existed under different categoryEn — handled
// via re-categorization below).
const ENTRIES: ImportEntry[] = [
  { sku: 'BIG-450', categoryEn: 'Vehicle Specific > Porsche > 991.2, Carrera (911)',
    collectionEn: 'Intercoolers',
    detailUrl: `${BASE}/en/artiklar/bigpack-porsche-911-carrera-9912.html`,
    tags: ['DO88', 'BigPack', 'Porsche', '991.2', 'Carrera', 'Intercooler Kit'] },
  // Audi RS6 / RS7 C8 carbon engine cover — listed as a peer to MK-100/110
  // covers in the catalog but not yet imported.
  { sku: 'MK-180', categoryEn: 'Vehicle Specific > Audi > RS6 RS7, 4.0 V8 TFSI (C8)',
    collectionEn: 'Performance Parts',
    detailUrl: `${BASE}/en/artiklar/carbon-fiber-engine-cover-audi-rs6-rs7-c8.html`,
    tags: ['DO88', 'Carbon Fiber', 'Engine Cover', 'Audi', 'RS6', 'RS7', 'C8'] },
  { sku: 'FB01075', categoryEn: 'Engine / Tuning > Air Filters > BMC Vehicle Specific',
    collectionEn: 'Air Filters',
    detailUrl: `${BASE}/en/artiklar/bmc-model-adapted-air-filter-porsche-992.html`,
    tags: ['DO88', 'BMC', 'Porsche', '992', 'Air Filter'] },

  // do88 VAG EA888 SAI Air Filter — replacement filter for the V2 intake
  // system. Sits as an accessory under A3/S3 8V (where the intake itself
  // already lives in our DB).
  { sku: 'LF-190-SAI-KIT', categoryEn: 'Vehicle Specific > Audi > A3 S3 TT, 2.0 TFSI EA888 (8V 8S)',
    collectionEn: 'Intake Systems',
    detailUrl: `${BASE}/en/artiklar/do88-vag-ea888-sai-air-filter.html`,
    tags: ['DO88', 'V2 Intake', 'SAI', 'VAG MQB'] },
];

/**
 * Re-categorizations: products that already live in our DB but under a
 * `categoryEn` that doesn't match any token from `do88FitmentData.ts`, so the
 * vehicle picker silently skips them. Updating just `categoryEn` (and
 * `categoryUa`) is a minimal, reversible change — nothing else gets touched.
 *
 * Sourced from `verify-chassis-coverage.ts` output and a manual DB scan of
 * `categoryEn` per SKU.
 */
type RecatEntry = {
  sku: string;
  newCategoryEn: string;
  /** Tags to drop because they hit `EXCLUDED_VEHICLE_PATTERNS` (CUPRA, SEAT, …). */
  dropTags?: string[];
  /** Force a clean titleEn / titleUa (rewrite supplier "AUDI VW SEAT SKODA …"
   *  prefixes that trigger our SEAT/SKODA exclusion patterns). */
  newTitleEn?: string;
  newTitleUa?: string;
};

const RECATEGORIZE: RecatEntry[] = [
  // CUPRA → VW Mk8 MQB Evo. The supplier filed these under CUPRA, which our
  // matcher excludes wholesale. Re-target the chassis token AND drop the
  // 'CUPRA' tag so isExcludedVehicleProduct doesn't keep filtering them out.
  { sku: 'ICM-380-S', newCategoryEn: 'Vehicle Specific > VW > Golf, 2.0T EA888 Gen 4 (Mk 8 MQB Evo)',
    dropTags: ['CUPRA'] },
  { sku: 'CP-120-1', newCategoryEn: 'Vehicle Specific > VW > Golf, 2.0T EA888 Gen 4 (Mk 8 MQB Evo)',
    dropTags: ['CUPRA'] },
  { sku: '917056-5002S', newCategoryEn: 'Vehicle Specific > VW > Golf, 2.0T EA888 Gen 4 (Mk 8 MQB Evo)',
    dropTags: ['CUPRA'],
    // Original title had "VW Audi Skoda …" — Skoda matches our exclusion
    // pattern. Drop Skoda from the visible label; fitment stays in body / tags.
    newTitleEn: 'VW / Audi 2.0 TSI EA888 Gen4 245hp (MQB Evo) Garrett PowerMax Turbo 450hp',
    newTitleUa: 'VW / Audi 2.0 TSI EA888 Gen4 245hp (MQB Evo) Garrett PowerMax Turbo 450hp' },
  // Garrett Big-stage turbos. Supplier title `AUDI VW SEAT SKODA …` matches
  // our SEAT/SKODA exclusion patterns. Rewrite to a clean VAG MQB title — the
  // fitment information lives in the body / tags either way.
  { sku: '898199-5001W', newCategoryEn: 'Vehicle Specific > VW > Golf, 1.8T / 2.0T EA888 (Mk 7/7.5 MQB)',
    newTitleEn: 'Audi / VW 2.0 TSI EA888 (MQB) Stage 1 Turbo 485hp, Garrett PowerMax',
    newTitleUa: 'Audi / VW 2.0 TSI EA888 (MQB) Stage 1 Turbo 485hp, Garrett PowerMax' },
  { sku: '898200-5001W', newCategoryEn: 'Vehicle Specific > VW > Golf, 1.8T / 2.0T EA888 (Mk 7/7.5 MQB)',
    newTitleEn: 'Audi / VW 2.0 TSI EA888 (MQB) Stage 2 Turbo 600hp, Garrett PowerMax',
    newTitleUa: 'Audi / VW 2.0 TSI EA888 (MQB) Stage 2 Turbo 600hp, Garrett PowerMax' },
];

function fetchPage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'OneCompany-DO88-Import/1.0', Cookie: COOKIE } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const next = res.headers.location;
        if (next && next.startsWith(BASE)) return fetchPage(next).then(resolve);
        return resolve(null);
      }
      if (res.statusCode !== 200) return resolve(null);
      let d = ''; res.setEncoding('utf-8');
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#8221;/g, '”').replace(/&#8220;/g, '“')
    .replace(/&#8217;/g, '\'').replace(/&#8216;/g, '\'')
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#160;/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&#176;/g, '°').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function extractDetail(html: string, sku: string) {
  // JSON-LD product node — most reliable source of title + description.
  const ldName = html.match(/"@type"\s*:\s*"Product"\s*,\s*"name"\s*:\s*"([^"]+)"/);
  const ldDesc = html.match(/"@type"\s*:\s*"Product"[\s\S]*?"description"\s*:\s*"([^"]+)"/);
  const titleEn = ldName ? decodeEntities(ldName[1]).trim() : '';
  const descEn = ldDesc ? decodeEntities(ldDesc[1]).trim().slice(0, 4500) : '';

  // Image: <img src="/bilder/artiklar/<SKU>.jpg?...">. Walk all <img> on page,
  // pick the first that contains the SKU.
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]*\/bilder\/artiklar\/[^"]+)"/g)].map((m) => m[1]);
  let image = imgs.find((u) => u.toLowerCase().includes(sku.toLowerCase())) ?? imgs[0] ?? '';
  if (image && image.startsWith('/')) image = `${BASE}${image}`;
  // Use the high-res `_1.jpg` variant when the listing thumb is `_S.jpg`.
  image = image.replace(/_S\.(jpg|png|webp)/i, '_1.$1');

  return { titleEn, descEn, image };
}

function buildBodyHtml(titleEn: string, descEn: string, sku: string, tags: string[]) {
  const safeDesc = descEn || `Premium DO88 performance part. Engineered in Sweden for maximum efficiency and reliability.`;
  const tagLine = tags.filter((t) => t !== 'DO88').slice(0, 6).join(' · ');
  return [
    `<p><strong>${titleEn}</strong></p>`,
    `<p>${safeDesc}</p>`,
    `<p><em>SKU: ${sku} · Brand: DO88 · Made in Sweden${tagLine ? ` · ${tagLine}` : ''}</em></p>`,
  ].join('');
}

function makeSlug(sku: string) {
  return `do88-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

async function main() {
  if (!fs.existsSync(SCRAPED)) {
    console.error('❌ No scraped file at', SCRAPED);
    process.exit(1);
  }
  const eu: Array<{ sku: string; priceEur: number }> = JSON.parse(fs.readFileSync(SCRAPED, 'utf-8'));
  const findEu = (sku: string) =>
    eu.find((p) => p.sku === sku) ?? eu.find((p) => p.sku.toLowerCase() === sku.toLowerCase());

  console.log(`📦 Importing ${ENTRIES.length} new SKUs (mode=${APPLY ? 'APPLY' : 'DRY RUN'})\n`);

  const prisma = new PrismaClient();

  // Pre-fetch existing slugs / SKUs to avoid creating duplicates.
  const existing = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'DO88', mode: 'insensitive' } },
    select: { id: true, sku: true, slug: true },
  });
  const existingBySku = new Map(
    existing
      .filter((p) => p.sku)
      .map((p) => [p.sku!.toLowerCase().replace(/^do88-/, ''), p])
  );

  const planRows: Array<{ sku: string; slug: string; status: string; titleEn: string; priceEur: number; image: string }> = [];

  for (const entry of ENTRIES) {
    const eu = findEu(entry.sku);
    if (!eu) { console.log(`  ⚠️  ${entry.sku}: no EU price — skip`); continue; }

    const skuKey = entry.sku.toLowerCase().replace(/^do88-/, '');
    const existingP = existingBySku.get(skuKey);
    if (existingP) {
      planRows.push({ sku: entry.sku, slug: existingP.slug, status: 'EXISTS', titleEn: '', priceEur: eu.priceEur, image: '' });
      continue;
    }

    const html = await fetchPage(entry.detailUrl);
    if (!html) {
      planRows.push({ sku: entry.sku, slug: makeSlug(entry.sku), status: 'NO_DETAIL', titleEn: '', priceEur: eu.priceEur, image: '' });
      continue;
    }
    const { titleEn, descEn, image } = extractDetail(html, entry.sku);
    const slug = makeSlug(entry.sku);

    planRows.push({ sku: entry.sku, slug, status: APPLY ? 'INSERT' : 'PLAN', titleEn, priceEur: eu.priceEur, image });

    if (!APPLY) continue;

    const bodyHtml = buildBodyHtml(titleEn, descEn, entry.sku, entry.tags);
    const collectionUa = collectionUkMap[entry.collectionEn] ?? entry.collectionEn;

    try {
      const created = await prisma.shopProduct.create({
        data: {
          slug,
          sku: entry.sku,
          brand: 'DO88',
          vendor: 'DO88',
          productType: 'Performance Part',
          productCategory: entry.categoryEn,
          status: 'ACTIVE',
          isPublished: true,
          titleEn, titleUa: titleEn,
          categoryEn: entry.categoryEn,
          categoryUa: entry.categoryEn,
          shortDescEn: `DO88 ${titleEn}. Premium quality, made in Sweden.`,
          shortDescUa: `DO88 ${titleEn}. Преміум якість, зроблено у Швеції.`,
          bodyHtmlEn: bodyHtml, bodyHtmlUa: bodyHtml,
          leadTimeEn: 'Ships in 5-10 business days',
          leadTimeUa: 'Відправка за 5-10 робочих днів',
          stock: 'inStock',
          collectionEn: entry.collectionEn,
          collectionUa,
          priceEur: eu.priceEur,
          image: image || null,
          tags: entry.tags,
          variants: {
            create: [{
              title: 'Default Title', sku: entry.sku, position: 1,
              inventoryQty: 0, inventoryPolicy: 'CONTINUE',
              priceEur: eu.priceEur, requiresShipping: true, taxable: true,
              image: image || null, isDefault: true,
            }],
          },
          ...(image
            ? { media: { create: [{ src: image, altText: titleEn, position: 1, mediaType: 'IMAGE' as const }] } }
            : {}),
        },
        select: { id: true, slug: true },
      });
      console.log(`  ✅ ${entry.sku.padEnd(22)} → ${created.slug}`);
    } catch (err) {
      console.log(`  ❌ ${entry.sku}: ${(err as Error).message}`);
    }
  }

  // Re-categorization pass — minimal update of `categoryEn` / `categoryUa`
  // for products misfiled at supplier level (e.g. parked under CUPRA when
  // they're VAG Gen-4 EA888 fitments).
  const recatRows: Array<{ sku: string; oldCat: string | null; newCat: string; status: string }> = [];
  for (const r of RECATEGORIZE) {
    const found = await prisma.shopProduct.findFirst({
      where: { sku: { equals: r.sku, mode: 'insensitive' } },
      select: { id: true, sku: true, categoryEn: true, titleEn: true, titleUa: true, tags: true },
    });
    if (!found) {
      recatRows.push({ sku: r.sku, oldCat: null, newCat: r.newCategoryEn, status: 'NOT_FOUND' });
      continue;
    }
    const wantsTitleChange = r.newTitleEn && r.newTitleEn !== found.titleEn;
    const wantsTagChange = (r.dropTags ?? []).some((t) => found.tags.includes(t));
    const wantsCatChange = found.categoryEn !== r.newCategoryEn;
    if (!wantsCatChange && !wantsTitleChange && !wantsTagChange) {
      recatRows.push({ sku: r.sku, oldCat: found.categoryEn, newCat: r.newCategoryEn, status: 'ALREADY' });
      continue;
    }
    recatRows.push({ sku: r.sku, oldCat: found.categoryEn, newCat: r.newCategoryEn, status: APPLY ? 'UPDATED' : 'PLAN' });
    if (APPLY) {
      try {
        const data: Record<string, unknown> = { categoryEn: r.newCategoryEn, categoryUa: r.newCategoryEn };
        if (r.newTitleEn) { data.titleEn = r.newTitleEn; data.titleUa = r.newTitleUa ?? r.newTitleEn; }
        if (r.dropTags?.length) {
          data.tags = found.tags.filter((t) => !r.dropTags!.includes(t));
        }
        await prisma.shopProduct.update({ where: { id: found.id }, data });
        console.log(`  🔁 ${r.sku.padEnd(22)} | cat → ${r.newCategoryEn.slice(0, 40)}${wantsTitleChange ? ' | title rewritten' : ''}${wantsTagChange ? ' | tags cleaned' : ''}`);
      } catch (err) {
        console.log(`  ❌ ${r.sku} recat: ${(err as Error).message}`);
      }
    }
  }

  // Snapshot the plan
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'artifacts/do88-new-skus', ts);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify({ apply: APPLY, planRows, recatRows }, null, 2), 'utf-8');
  console.log(`\n💾 Plan snapshot: ${outDir}/plan.json`);
  console.log(`Inserts: ${planRows.length} | already in DB: ${planRows.filter((r) => r.status === 'EXISTS').length} | applied: ${planRows.filter((r) => r.status === 'INSERT').length}`);
  console.log(`Recategorize: ${recatRows.length} | already correct: ${recatRows.filter((r) => r.status === 'ALREADY').length} | applied: ${recatRows.filter((r) => r.status === 'UPDATED').length}`);

  // Per project memory `dev_shop_products_cache.md` — wipe the dev cache so
  // freshly inserted products appear without waiting for the 3h TTL.
  if (APPLY) {
    const cachePath = path.join(process.cwd(), '.shop-products-dev-cache.json');
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      console.log(`🧹 Deleted dev cache: ${cachePath}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
