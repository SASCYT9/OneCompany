#!/usr/bin/env node
/**
 * Cross-references the logo audit (audit-brand-logos.mjs) with the active brand
 * roster — i.e. brands that appear in at least one category in categoryData.ts.
 *
 * Goal: separate "must fix now" (logos shown on a live category page) from
 * "low priority" (logos referenced by `brands.ts` registry but not surfaced
 * on any category list yet).
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadCategoryData() {
  const src = readFileSync(join(ROOT, 'src/lib/categoryData.ts'), 'utf8');
  // Capture each `brands: [ ... ],` block. The category objects also have a `slug`.
  const brandsByCategory = {};
  const blockRe = /slug:\s*['"]([\w-]+)['"][\s\S]*?brands:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = blockRe.exec(src))) {
    const slug = m[1];
    const arr = m[2];
    const names = [...arr.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
    brandsByCategory[slug] = names;
  }
  return brandsByCategory;
}

function loadBrandLogos() {
  const src = readFileSync(join(ROOT, 'src/lib/brandLogos.ts'), 'utf8');
  const map = {};
  const re = /'([^']+)':\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    map[m[1]] = m[2];
  }
  return map;
}

function loadInvertSets() {
  const src = readFileSync(join(ROOT, 'src/lib/invertBrands.ts'), 'utf8');
  function extractSet(name) {
    const re = new RegExp(`const\\s+${name}\\s*=\\s*new Set\\(\\s*\\[([\\s\\S]*?)\\]`);
    const m = src.match(re);
    if (!m) return new Set();
    const arr = m[1];
    return new Set([...arr.matchAll(/['"]([^'"]+)['"]/g)].map((x) => normBrand(x[1])));
  }
  return {
    INVERT: extractSet('INVERT_BRANDS_NORMALIZED'),
    SMART_INVERT: extractSet('SMART_INVERT_BRANDS_NORMALIZED'),
    NO_INVERT: extractSet('NO_INVERT_BRANDS_NORMALIZED'),
  };
}

function normBrand(value) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const categories = loadCategoryData();
const logoMap = loadBrandLogos();
const invertSets = loadInvertSets();

const activeBrands = new Set();
for (const slug of Object.keys(categories)) {
  for (const name of categories[slug]) activeBrands.add(name);
}

// Run audit script and parse JSON
const result = spawnSync('node', [join(ROOT, 'scripts/audit-brand-logos.mjs'), '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (result.status !== 0) {
  console.error('audit-brand-logos.mjs failed');
  console.error(result.stderr);
  process.exit(1);
}
const audit = JSON.parse(result.stdout);
const flaggedByFile = new Map();
for (const r of audit) {
  if (!r.issues || r.issues.length === 0) continue;
  flaggedByFile.set(r.fileName, r);
}

// For each active brand, find its logo file and check if flagged.
// Filter out issues that are already handled at runtime via invert lists.
const activeIssues = [];
for (const name of [...activeBrands].sort()) {
  const path = logoMap[name];
  if (!path) {
    activeIssues.push({ name, file: null, kinds: ['no-logo-mapping'], details: ['brand has no entry in BRAND_LOGO_MAP'] });
    continue;
  }
  const fileName = basename(path);
  const flagged = flaggedByFile.get(fileName);
  if (flagged) {
    const norm = normBrand(name);
    const isInverted = invertSets.INVERT.has(norm) || invertSets.SMART_INVERT.has(norm);
    const kinds = [];
    const details = [];
    for (const issue of flagged.issues) {
      // Brands in the runtime invert list have their dark logos flipped to white,
      // so "logo-too-dark" is a false positive for them.
      if (issue.kind === 'logo-too-dark' && isInverted) continue;
      kinds.push(issue.kind);
      details.push(issue.detail);
    }
    if (kinds.length > 0) {
      activeIssues.push({ name, file: fileName, kinds, details, meta: flagged.meta, isInverted });
    }
  }
}

// Find which CATEGORY each flagged active brand is in
const brandToCategories = {};
for (const slug of Object.keys(categories)) {
  for (const name of categories[slug]) {
    brandToCategories[name] ??= [];
    brandToCategories[name].push(slug);
  }
}

console.log(`\n=== Active-brand logo issues — ${activeBrands.size} active brands, ${activeIssues.length} flagged ===\n`);

// Group by issue kind for action planning
const byKind = {};
for (const ai of activeIssues) {
  for (const k of ai.kinds) {
    byKind[k] ??= [];
    byKind[k].push(ai);
  }
}

const order = [
  'no-logo-mapping',
  'opaque-light-bg',
  'logo-too-dark',
  'jpeg-format',
  'no-alpha',
  'tiny-dims',
  'small-dims',
  'over-compressed',
  'extreme-aspect',
  'flat-grey',
  'svg-bloated',
  'load-error',
  'metadata-error',
  'invalid-dims',
];
for (const k of order) {
  const items = byKind[k];
  if (!items || items.length === 0) continue;
  console.log(`-- ${k} (${items.length}) --`);
  for (const it of items) {
    const cats = brandToCategories[it.name]?.join(',') || '?';
    const dimStr = it.meta?.width ? ` ${it.meta.width}x${it.meta.height}` : '';
    console.log(`  [${cats}] ${it.name}  →  ${it.file || 'NO FILE'}${dimStr}`);
  }
  console.log('');
}

// Print breakdown by category
console.log('\n=== Breakdown by category (count of flagged brands) ===');
const cnt = {};
for (const ai of activeIssues) {
  const cats = brandToCategories[ai.name] || [];
  for (const c of cats) {
    cnt[c] = (cnt[c] || 0) + 1;
  }
}
for (const [c, n] of Object.entries(cnt).sort((a, b) => b[1] - a[1])) {
  const total = (categories[c] || []).length;
  console.log(`  ${c}: ${n}/${total} flagged`);
}
