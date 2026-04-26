#!/usr/bin/env node
/**
 * Full audit: every visible DO88 product cross-referenced against the
 * vehicle filter UI options.
 *
 * Reports:
 *   - total visible product count (after price + chassis exclusions)
 *   - per-chassis filter result count (does each option return ≥1 product?)
 *   - description enrichment status per product (curated / generated / generic)
 *   - any product matching ZERO filter chassis (orphan)
 */

const API = 'http://localhost:3000/api/shop/products';

// Mirror of CAR_DATA in Do88VehicleFilter.tsx — { label, keyword }.
// `keyword` is what gets sent to the catalog ?keyword= filter.
const FILTER_OPTIONS = {
  Porsche: [
    { label: '911 Turbo S (992)', keyword: '992' },
    { label: '911 (992)', keyword: '992' },
    { label: '911 (991)', keyword: '991' },
    { label: '911 (997)', keyword: '997' },
    { label: '911 (996)', keyword: '996' },
    { label: '911 (993)', keyword: '993' },
    { label: '911 (964)', keyword: '964' },
  ],
  BMW: [
    { label: 'M2 (G87)', keyword: 'G87' },
    { label: 'M3 / M4 (G80/G82)', keyword: 'G80/G82' },
    { label: 'M3 / M4 (F80/F82)', keyword: 'F80/F82' },
    { label: 'M2 (F87)', keyword: 'F87' },
    { label: 'M340i / M440i (G20/G22, B58)', keyword: 'G20/G22/B58' },
    { label: 'Z4 M40i (G29, B58)', keyword: 'Z4' },
  ],
  Audi: [
    { label: 'RS6 / RS7 (C8)', keyword: 'C8' },
    { label: 'RS3 / TTRS (8V/8S)', keyword: 'RS3/TTRS' },
    { label: 'A3 / S3 (8V/8Y, 2015+)', keyword: '8V/8Y' },
  ],
  VW: [
    { label: 'Golf GTI / R (Mk7/Mk7.5)', keyword: 'Mk7' },
    { label: 'Golf GTI / R (Mk8)', keyword: 'Mk8' },
  ],
  Toyota: [
    { label: 'GR Supra (A90)', keyword: 'Supra' },
    { label: 'GR Yaris', keyword: 'Yaris' },
  ],
};

const EXCLUSION_PATTERNS = [
  /\bvolvo\b/i,
  /\b(?:240|740|850|940|s60|v60|v70|s70|xc60|xc70|xc90)\b/i,
  /\bsaab\b/i, /\b9-3\b/i, /\b9-5\b/i, /\b9000\b/i, /\bsaab\s*900\b/i, /\bog\s*900\b/i,
  /\baudi\s+(?:s2|rs2|80|90|100|200|a4|s4|a6|s6|a8|s8)\b/i,
  /\brs[67]\s*\(?(?:c[567])\b/i,
  /\b\d{4}-\d{4}\b\s*(?:s2|rs2)\b/i,
  /\b(?:aby|adu|3b)\b\s*(?:1\d{3})/i,
  /\baudi\s+s[3-6]\s+tt\b/i,
  /\b(?:8l|8n|8p)\b/i,
  /\baudi\b[^.]*\b(?:b5|b6|b7|b8|b9)\b/i,
  /\b(?:e2[0-9]|e3[0-9]|e4[0-9]|e5[0-9]|e6[0-9]|e7[0-9]|e8[0-9]|e9[0-9])\b/i,
  /\b(?:f10|f11|f20|f21|f22|f23|f30|f31|f32|f33|f34|f36)\b/i,
  /\b(?:mk[1-6]|mark\s*[1-6])\b/i,
  /\b1\.8t\b\s+(?:8l|8n|mk[1-6])/i,
  /\b911\s*\(?930\)?\b/i,
  /\bsuzuki\b/i, /\bopel\b/i, /\bbuick\b/i, /\bcupra\b/i, /\bseat(?:\b|\s)/i,
  /\bskoda\b/i, /\bford\b/i, /\bmazda\b/i, /\brenault\b/i,
  /\balpine\s*(?:a110|a90)/i, /\bvectra\b/i, /\binsignia\b/i,
  /\bformentor\b/i, /\bswift\b/i,
  /\baudi\s+quattro\s+\d+v\b/i, /\b20v\s+(?:turbo|quattro)\b/i,
];

function isExcluded(p) {
  const hay = [p.title?.en, p.title?.ua, p.collection?.en, p.collection?.ua, ...(p.tags ?? [])].join(' ');
  return EXCLUSION_PATTERNS.some((re) => re.test(hay));
}

function priceEur(p) {
  for (const v of p.variants ?? []) {
    const eur = v.pricing?.effectivePrice?.eur ?? 0;
    if (eur > 0) return eur;
  }
  return 0;
}

// Mirror of the catalog filter exactly: AND across whitespace tokens, each
// token's "/" splits to OR options, parens stripped.
function matchesFilter(product, brand, keyword) {
  const hay = [
    product.title?.en ?? '', product.title?.ua ?? '',
    product.shortDescription?.en ?? '', product.shortDescription?.ua ?? '',
    product.longDescription?.en ?? '', product.longDescription?.ua ?? '',
    (product.tags ?? []).join(' '),
    product.slug ?? '', product.sku ?? '',
  ].join(' ').toLowerCase();
  const matchesBrand = hay.includes(brand.toLowerCase());
  if (!matchesBrand) return false;
  const groups = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  return groups.every((group) => {
    const options = group.split('/').map((o) => o.replace(/[()]/g, ''));
    return options.some((opt) => opt && hay.includes(opt));
  });
}

async function main() {
  const res = await fetch(API);
  const products = await res.json();
  const do88 = products.filter((p) => (p.brand || '').toLowerCase() === 'do88');
  const visible = do88.filter((p) => {
    if (isExcluded(p)) return false;
    const eur = priceEur(p);
    return eur === 0 || eur >= 200;
  });

  // Read generated specs to know which SKUs are enriched
  const fs = await import('node:fs/promises');
  const specsTs = await fs.readFile(new URL('../../src/lib/do88GeneratedSpecs.ts', import.meta.url), 'utf-8');
  const generatedSkus = new Set();
  for (const m of specsTs.matchAll(/'([A-Z][A-Z0-9_-]*?)':\s*\{/g)) generatedSkus.add(m[1]);

  const manualSpecsTs = await fs.readFile(new URL('../../src/lib/do88ProductSpecs.ts', import.meta.url), 'utf-8');
  const manualSkus = new Set();
  for (const m of manualSpecsTs.matchAll(/'([A-Z][A-Z0-9_-]*?)':\s*\{/g)) manualSkus.add(m[1]);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  DO88 catalog audit');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total DO88 products in DB:        ${do88.length}`);
  console.log(`  Visible after exclusions+price:   ${visible.length}`);
  console.log(`  Hand-curated specs:               ${manualSkus.size}`);
  console.log(`  Auto-generated specs:             ${generatedSkus.size}`);

  // Enrichment coverage
  let enriched = 0, generic = 0;
  for (const p of visible) {
    const sku = (p.sku || '').toUpperCase();
    if (manualSkus.has(sku) || generatedSkus.has(sku)) enriched++;
    else generic++;
  }
  const pct = Math.round((enriched / visible.length) * 100);
  console.log(`  Enriched (manual or generated):   ${enriched} (${pct}%)`);
  console.log(`  Generic kind-based fallback:      ${generic}`);
  console.log();

  // Per filter chassis option
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Filter chassis options — products returned per option');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const empty = [];
  for (const [brand, models] of Object.entries(FILTER_OPTIONS)) {
    console.log(`  ${brand}:`);
    for (const entry of models) {
      const matches = visible.filter((p) => matchesFilter(p, brand, entry.keyword));
      const flag = matches.length === 0 ? '  ⚠ EMPTY' : '';
      console.log(`    ${matches.length.toString().padStart(3)}  ${entry.label.padEnd(38)} (keyword: ${entry.keyword})${flag}`);
      if (matches.length === 0) empty.push({ brand, label: entry.label });
    }
  }
  console.log();

  if (empty.length > 0) {
    console.log(`  ⚠ ${empty.length} chassis option(s) return zero products — users picking these get an empty catalog page.`);
    empty.forEach((e) => console.log(`     - ${e.brand} → ${e.label}`));
    console.log();
  }

  // Orphan products (visible but not matching any filter)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Visible products not matching any filter option');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const allFilterSets = Object.entries(FILTER_OPTIONS).flatMap(([brand, models]) =>
    models.map((m) => ({ brand, keyword: m.keyword })),
  );
  const orphans = visible.filter((p) => !allFilterSets.some(({ brand, keyword }) => matchesFilter(p, brand, keyword)));
  console.log(`  Total: ${orphans.length} of ${visible.length}`);
  console.log('  These are universal/generic items (Setrab oil coolers, GFB valves,');
  console.log('  Garrett cores, big silicone rolls, etc.) — discoverable only via the');
  console.log('  category browse, not the vehicle filter.');
  console.log();
  console.log('  Sample (15):');
  for (const p of orphans.slice(0, 15)) {
    const eur = priceEur(p);
    const t = (p.title?.ua || '').slice(0, 70);
    console.log(`    €${eur.toString().padStart(7)}  ${t}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
