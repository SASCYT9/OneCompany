#!/usr/bin/env node
/**
 * Audit visible DO88 products for description quality.
 *
 * Pulls the live API response, applies the same exclusion rules as the
 * catalog (€200+ threshold, supported chassis), then checks each product's
 * rendered description sections for:
 *   - empty / repeated copy
 *   - leftover Swedish / mixed-language fragments
 *   - mismatched fitment vs title
 *   - invalid OE references (e.g. junk capture from regex)
 *   - duplicate bullets
 *
 * Run: node scripts/do88/audit-descriptions.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = path.join(__dirname, 'scraped', 'audit-report.json');

const SWEDISH_FRAGMENTS = [
  /\bdetta\b/i, /\boch\b/i, /\bf[oö]r\b/i, /\bsom\b/i, /\bden\b/i,
  /\bvi\b/i, /\bsamt\b/i, /\bav\b/i, /\bett\b/i, /\bvid\b/i,
  /\binte\b/i, /\bdesign\s+av\b/i, /\bär\b/i, /\bmen\b/i, /\bj[äa]mf[öo]rt\b/i,
  /\bmedf[öo]ljande\b/i, /\bbeh[öo]ver\b/i, /\bbeh[öo]vs\b/i, /\bsanning\b/i,
  /\bv[åa]r\b/i, /\bkylare\b/i, /\bslang(?:ar)?\b/i,
  /\binloppstemperatur\b/i, /\bytarea\b/i,
];

const ENGLISH_LEFTOVERS = [
  /\bSuits\b/, /\bLate-Model\b/i, /\band\b\s+[A-ZА-Я]/,
];

function isSuspiciousOe(oe) {
  // OE numbers from real automotive suppliers are typically 8–14 chars,
  // alphanumeric. We capture sometimes too greedily — flag candidates that
  // are too short, contain dashes after a digit, or look like dates.
  if (!oe || typeof oe !== 'string') return 'not a string';
  if (oe.length < 6) return 'too short';
  if (oe.length > 16) return 'too long';
  if (/^\d{4,}$/.test(oe)) return 'all digits';
  if (/^\d{4}-\d{4}$/.test(oe)) return 'looks like year range';
  if (/^[A-Z]+$/.test(oe)) return 'no digits';
  return null;
}

async function loadProducts() {
  const res = await fetch('http://localhost:3000/api/shop/products');
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

function priceEur(p) {
  for (const v of p.variants || []) {
    const eur = v.pricing?.effectivePrice?.eur ?? 0;
    if (eur > 0) return eur;
  }
  return 0;
}

const EXCLUSION_PATTERNS = [
  /\bvolvo\b/i, /\b(?:240|740|850|940|s60|v60|v70|s70|xc60|xc70|xc90)\b/i,
  /\bsaab\b/i, /\b9-3\b/i, /\b9-5\b/i, /\b9000\b/i, /\bsaab\s*900\b/i,
  /\baudi\s+(?:s2|rs2|80|90|100|200|a4|s4|a6|s6|a8|s8)\b/i,
  /\brs[67]\s*\(?(?:c[567])\b/i,
  /\b(?:8l|8n|8p)\b/i,
  /\baudi\b[^.]*\b(?:b5|b6|b7|b8|b9)\b/i,
  /\b(?:e2[0-9]|e3[0-9]|e4[0-9]|e5[0-9]|e6[0-9]|e7[0-9]|e8[0-9]|e9[0-9])\b/i,
  /\b(?:f10|f11|f20|f21|f22|f23|f30|f31|f32|f33|f34|f36)\b/i,
  /\b(?:mk[1-6]|mark\s*[1-6])\b/i,
  /\b911\s*\(?930\)?\b/i,
];

function isExcluded(p) {
  const hay = [p.title?.en, p.title?.ua, p.collection?.en, p.collection?.ua, ...(p.tags ?? [])].join(' ');
  return EXCLUSION_PATTERNS.some((re) => re.test(hay));
}

async function main() {
  const products = await loadProducts();
  const do88 = products.filter((p) => (p.brand || '').toLowerCase() === 'do88');
  const visible = do88.filter((p) => {
    if (isExcluded(p)) return false;
    const eur = priceEur(p);
    return eur === 0 || eur >= 200;
  });

  console.log(`[input] ${do88.length} DO88 products → ${visible.length} visible`);

  // Pull generated specs to inspect what enrichment is doing
  const generatedRaw = await fs.readFile(path.join(__dirname, '..', '..', 'src', 'lib', 'do88GeneratedSpecs.ts'), 'utf-8');

  const issues = {
    swedishLeftover: [],
    englishLeftover: [],
    duplicateBullets: [],
    suspiciousOe: [],
    fitmentMismatch: [],
    headlineRepeatsTitle: [],
    emptyEnrichment: [],
    weirdHeadline: [],
  };

  // For each visible product, look up its generated spec block in the file
  for (const p of visible) {
    const sku = (p.sku || '').toUpperCase();
    if (!sku) continue;
    const re = new RegExp(`'${sku.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}': \\{([\\s\\S]*?)^\\},`, 'm');
    const match = generatedRaw.match(re);
    if (!match) {
      // No generated entry — falls back to kind-based generic. Skip from this audit.
      continue;
    }
    const block = match[1];

    const headlineUaMatch = block.match(/headline:\s*\{[\s\S]*?ua:\s*"((?:[^"\\]|\\.)*)"/);
    const headlineUa = headlineUaMatch ? headlineUaMatch[1] : '';

    const fitmentUaMatch = block.match(/fitment:\s*\{[\s\S]*?ua:\s*"((?:[^"\\]|\\.)*)"/);
    const fitmentUa = fitmentUaMatch ? fitmentUaMatch[1] : null;

    const bulletsUa = [];
    for (const m of block.matchAll(/ua:\s*\[\s*((?:"(?:[^"\\]|\\.)*",\s*)+)\]/g)) {
      const arr = m[1].match(/"((?:[^"\\]|\\.)*)"/g) || [];
      arr.forEach((s) => bulletsUa.push(s.slice(1, -1)));
    }
    // Filter: bulletsUa includes headline matches sometimes — drop short/headline strings
    const realBullets = bulletsUa.filter((b) => b.length > 5 && !b.endsWith('.') === false || b.length > 10);

    const oeMatch = block.match(/replacesOe:\s*\[(.*?)\]/);
    const oeRefs = oeMatch ? (oeMatch[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map((s) => s.slice(1, -1)) : [];

    // Detect Swedish leftover words
    const allText = [headlineUa, fitmentUa, ...realBullets].filter(Boolean).join(' | ');
    for (const re of SWEDISH_FRAGMENTS) {
      if (re.test(allText)) {
        issues.swedishLeftover.push({ sku, fragment: allText.match(re)?.[0], in: allText.slice(0, 160) });
        break;
      }
    }
    for (const re of ENGLISH_LEFTOVERS) {
      if (re.test(allText)) {
        issues.englishLeftover.push({ sku, fragment: allText.match(re)?.[0], in: allText.slice(0, 160) });
        break;
      }
    }

    // Duplicate bullets within the entry
    const bulletSet = new Set();
    for (const b of realBullets) {
      const k = b.toLowerCase().replace(/\s+/g, ' ').trim();
      if (bulletSet.has(k)) {
        issues.duplicateBullets.push({ sku, bullet: b });
        break;
      }
      bulletSet.add(k);
    }

    // Headline that just repeats the title (a sign of generic fallback)
    const titleUa = (p.title?.ua || '').toLowerCase();
    if (headlineUa && titleUa && headlineUa.toLowerCase().includes(titleUa.slice(0, 30))) {
      issues.headlineRepeatsTitle.push({ sku, head: headlineUa.slice(0, 100), title: p.title?.ua?.slice(0, 60) });
    }

    // Suspicious OE numbers
    for (const oe of oeRefs) {
      const reason = isSuspiciousOe(oe);
      if (reason) {
        issues.suspiciousOe.push({ sku, oe, reason });
      }
    }

    // Empty / minimal enrichment (no sections)
    const sectionsCount = (block.match(/kicker:/g) || []).length;
    if (sectionsCount === 0 && oeRefs.length === 0) {
      issues.emptyEnrichment.push({ sku, headline: headlineUa.slice(0, 100) });
    }

    // Weird headline patterns
    if (/^[.,!]/.test(headlineUa) || /\.\s*\./.test(headlineUa) || /\s\s+/.test(headlineUa)) {
      issues.weirdHeadline.push({ sku, headline: headlineUa });
    }

    // Fitment mismatch heuristic — if fitment says Audi but title doesn't, flag.
    if (fitmentUa) {
      const fitTokens = fitmentUa.match(/Audi|BMW|Porsche|VW|Volkswagen|Toyota|Volvo|Saab/gi) || [];
      const titleStr = `${p.title?.ua || ''} ${p.title?.en || ''}`;
      for (const brand of new Set(fitTokens.map((t) => t.toLowerCase()))) {
        const reBrand = new RegExp(`\\b${brand}\\b`, 'i');
        if (!reBrand.test(titleStr)) {
          issues.fitmentMismatch.push({ sku, brand, fitment: fitmentUa, title: p.title?.ua });
          break;
        }
      }
    }
  }

  // Print summary
  console.log('\n=== AUDIT SUMMARY ===');
  for (const [k, list] of Object.entries(issues)) {
    console.log(`  ${k.padEnd(28)}: ${list.length}`);
  }

  console.log('\n=== Swedish leftovers (first 8) ===');
  issues.swedishLeftover.slice(0, 8).forEach((i) => {
    console.log(`  [${i.sku}] frag="${i.fragment}" in: ${i.in}`);
  });

  console.log('\n=== English leftovers (first 8) ===');
  issues.englishLeftover.slice(0, 8).forEach((i) => {
    console.log(`  [${i.sku}] frag="${i.fragment}" in: ${i.in}`);
  });

  console.log('\n=== Duplicate bullets (first 5) ===');
  issues.duplicateBullets.slice(0, 5).forEach((i) => {
    console.log(`  [${i.sku}] "${i.bullet}"`);
  });

  console.log('\n=== Suspicious OE refs (first 12) ===');
  issues.suspiciousOe.slice(0, 12).forEach((i) => {
    console.log(`  [${i.sku}] ${i.oe} — ${i.reason}`);
  });

  console.log('\n=== Fitment mismatches (first 8) ===');
  issues.fitmentMismatch.slice(0, 8).forEach((i) => {
    console.log(`  [${i.sku}] fitment "${i.fitment}" but title "${i.title}"`);
  });

  console.log('\n=== Weird headlines (first 8) ===');
  issues.weirdHeadline.slice(0, 8).forEach((i) => {
    console.log(`  [${i.sku}] "${i.headline}"`);
  });

  console.log('\n=== Empty enrichment (no sections, no OE) (first 8) ===');
  issues.emptyEnrichment.slice(0, 8).forEach((i) => {
    console.log(`  [${i.sku}] "${i.headline}"`);
  });

  await fs.writeFile(REPORT_FILE, JSON.stringify({ visibleCount: visible.length, issues }, null, 2), 'utf-8');
  console.log(`\n[done] full report → ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
