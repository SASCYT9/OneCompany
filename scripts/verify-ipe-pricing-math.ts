#!/usr/bin/env tsx
/**
 * Re-runs `resolveIpeVariantPricing` against the BMW M3/M4 G80/G82 product
 * using the latest official-snapshot + parsed price-list artifacts. Prints a
 * variant-by-variant pricing table so we can confirm the option-axis gating
 * actually differentiates Cat-back vs Full System.
 *
 * Usage: pnpm tsx scripts/verify-ipe-pricing-math.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  buildIpeVariantCandidates,
  resolveIpeVariantPricing,
  type IpeOfficialSnapshot,
  type IpeOfficialProductSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
} from '../src/lib/ipeCatalogImport';

const HANDLE = 'bmw-m3-m4-g80-g82-exhaust';
const ARTIFACT_DIR = path.join(process.cwd(), 'artifacts', 'ipe-import', '2026-04-22T18-48-06-934Z');
const PRICE_LIST_PATH = path.join(process.cwd(), 'artifacts', 'ipe-price-list', '2025-price-list.parsed.json');

async function main() {
  const snapshot: IpeOfficialSnapshot = JSON.parse(await fs.readFile(path.join(ARTIFACT_DIR, 'official-snapshot.json'), 'utf-8'));
  const priceList: IpeParsedPriceList = JSON.parse(await fs.readFile(PRICE_LIST_PATH, 'utf-8'));

  const product = snapshot.products.find((p) => p.handle === HANDLE);
  if (!product) {
    console.error(`Product not found in snapshot: ${HANDLE}`);
    process.exit(1);
  }

  const rows: IpeParsedPriceListRow[] = priceList.items.filter(
    (row) => /BMW/i.test(row.brand) && /G80|G82/.test(row.model ?? '')
  );

  console.log(`Product: ${product.title}`);
  console.log(`Matched ${rows.length} price-list rows for G80/G82\n`);

  console.log('Pricing per Shopify variant:');
  const candidates = buildIpeVariantCandidates(product as IpeOfficialProductSnapshot, rows);
  for (const candidate of candidates) {
    const pricing = resolveIpeVariantPricing(product as IpeOfficialProductSnapshot, candidate, rows);
    const label = candidate.optionValues.filter(Boolean).join(' / ') || candidate.title;
    const baseDesc = pricing.baseRow ? `${pricing.baseRow.section ?? ''} ${pricing.baseRow.description}`.trim() : 'NO BASE';
    const deltaDesc = pricing.deltaRows.map((r) => `${r.description} (+$${r.retail_usd ?? r.msrp_usd ?? 0})`).join(', ') || '—';
    console.log(`  $${pricing.priceUsd ?? 'NULL'}\t ${label}`);
    console.log(`    base:  ${baseDesc} = $${pricing.baseRow?.retail_usd ?? '?'}`);
    console.log(`    delta: ${deltaDesc}`);
  }

  // Sanity assertions
  const priced = candidates
    .map((c) => resolveIpeVariantPricing(product as IpeOfficialProductSnapshot, c, rows))
    .filter((p): p is ReturnType<typeof resolveIpeVariantPricing> & { priceUsd: number } => p.priceUsd != null);
  const unique = new Set(priced.map((p) => p.priceUsd));
  console.log(`\n${candidates.length} variants -> ${unique.size} distinct price points: [${Array.from(unique).sort((a, b) => a - b).map((p) => `$${p}`).join(', ')}]`);
  if (unique.size <= 1) {
    console.error('FAIL: variants did not differentiate by price');
    process.exit(1);
  }
  console.log('OK: variants now differentiate by option axis');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
