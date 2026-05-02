/**
 * Full iPE catalog audit:
 *  1. List products by health: variants count, distinct prices, zero/null
 *     prices, suspicious flat pricing.
 *  2. Cross-check coverage of new 2026 V2.0 SKUs (which ones got mapped to a
 *     handle, which dangle).
 *  3. Product/handle gaps (DB has but snapshot doesn't, or vice versa).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import fs from 'node:fs';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import {
  buildIpeCanonicalTokenSetFromPriceRow,
  buildIpeCanonicalTokenSetFromOfficialProduct,
  scoreIpeCanonicalTokenSets,
  type IpeOfficialSnapshot,
  type IpeParsedPriceList,
} from '../src/lib/ipeCatalogImport';

const prisma = new PrismaClient();
const ART = path.join(process.cwd(), 'artifacts');
const SNAP = path.join(ART, 'ipe-import', '2026-04-22T18-48-06-934Z', 'official-snapshot.json');
const NEW = path.join(ART, 'ipe-price-list', '2026-04-pricelist.parsed.json');

(async () => {
  const snapshot: IpeOfficialSnapshot = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  const newList: IpeParsedPriceList = JSON.parse(fs.readFileSync(NEW, 'utf8'));

  // 1. DB product health
  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: { contains: 'iPE', mode: 'insensitive' } },
    include: { variants: true },
    orderBy: { slug: 'asc' },
  });

  let zeroPrice = 0;
  let nullPrice = 0;
  let flatMulti = 0;
  let oneVariant = 0;
  const flatList: string[] = [];
  const zeroList: string[] = [];
  const issues: string[] = [];

  for (const r of dbProducts) {
    const vs = r.variants;
    if (vs.length === 0) {
      issues.push(`${r.slug} — 0 variants`);
      continue;
    }
    if (vs.length === 1) {
      oneVariant += 1;
      const u = vs[0].priceUsd != null ? Number(vs[0].priceUsd) : null;
      if (u == null) nullPrice += 1;
      else if (u <= 0) zeroPrice += 1;
      continue;
    }
    const priceSet = new Set(vs.map((v) => (v.priceUsd != null ? Number(v.priceUsd) : NaN)));
    if (priceSet.has(NaN)) {
      nullPrice += 1;
      issues.push(`${r.slug} — has variant(s) with null priceUsd`);
    }
    if ([...priceSet].some((p) => !Number.isNaN(p) && p <= 0)) {
      zeroPrice += 1;
      zeroList.push(r.slug);
    }
    const distinctPositive = new Set([...priceSet].filter((p) => Number.isFinite(p) && p > 0));
    const optsSet = new Set(
      vs.map((v) =>
        [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(' | ').toLowerCase()
      )
    );
    if (distinctPositive.size === 1 && optsSet.size > 1) {
      flatMulti += 1;
      flatList.push(`${r.slug} (${vs.length}v @ $${[...distinctPositive][0]})`);
    }
  }

  console.log('=== iPE catalog audit ===');
  console.log(`DB products: ${dbProducts.length}`);
  console.log(`  single-variant: ${oneVariant}`);
  console.log(`  multi-variant w/ flat positive price: ${flatMulti}`);
  console.log(`  with zero priceUsd: ${zeroPrice}`);
  console.log(`  with null priceUsd: ${nullPrice}`);
  if (issues.length) {
    console.log('\nIssues:');
    for (const i of issues) console.log('  -', i);
  }
  if (flatList.length) {
    console.log('\nFlat-priced multi-variant products (likely needing review):');
    for (const f of flatList) console.log('  -', f);
  }
  if (zeroList.length) {
    console.log('\nProducts with $0 priceUsd variants:');
    for (const z of zeroList) console.log('  -', z);
  }

  // 2. Coverage of new 2026 SKUs
  const preparedProducts = snapshot.products.map((product) => ({
    product,
    tokens: buildIpeCanonicalTokenSetFromOfficialProduct(product),
  }));
  const byMake = new Map<string, typeof preparedProducts>();
  for (const e of preparedProducts) {
    if (!e.tokens.vehicleMake) continue;
    const list = byMake.get(e.tokens.vehicleMake) ?? [];
    list.push(e);
    byMake.set(e.tokens.vehicleMake, list);
  }
  let priced = 0;
  let mappedWell = 0;
  let mappedReview = 0;
  let unmapped = 0;
  for (const row of newList.items) {
    if (row.msrp_usd == null) continue;
    priced += 1;
    const rowTokens = buildIpeCanonicalTokenSetFromPriceRow(row);
    const pool = rowTokens.vehicleMake ? byMake.get(rowTokens.vehicleMake) ?? preparedProducts : preparedProducts;
    let best = 0;
    for (const e of pool) {
      const score = scoreIpeCanonicalTokenSets(rowTokens, e.tokens).total;
      if (score > best) best = score;
    }
    if (best >= 0.75) mappedWell += 1;
    else if (best >= 0.55) mappedReview += 1;
    else unmapped += 1;
  }
  console.log('\n=== 2026 V2.0 price-list coverage ===');
  console.log(`Total priced rows: ${priced}`);
  console.log(`  mapped (score ≥ 0.75 — auto): ${mappedWell}`);
  console.log(`  mapped (0.55 ≤ score < 0.75 — review): ${mappedReview}`);
  console.log(`  unmapped (score < 0.55): ${unmapped}`);

  // 3. DB slugs vs snapshot handles
  const snapHandles = new Set(snapshot.products.map((p) => p.handle));
  const dbHandlesIpe = dbProducts.map((p) => p.slug.replace(/^ipe-/, ''));
  const orphansInDb = dbHandlesIpe.filter((h) => !snapHandles.has(h));
  console.log('\n=== Handle alignment ===');
  console.log(`Snapshot iPE handles: ${snapHandles.size}`);
  console.log(`DB iPE products: ${dbProducts.length}`);
  if (orphansInDb.length) {
    console.log(`DB products without snapshot match: ${orphansInDb.length}`);
    for (const o of orphansInDb.slice(0, 10)) console.log('  -', o);
  }

  await prisma.$disconnect();
})();
