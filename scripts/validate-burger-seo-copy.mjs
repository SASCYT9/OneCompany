// Validate source-backed local Burger copy drafts before any catalog import.
// Run: node scripts/validate-burger-seo-copy.mjs YYYY-MM-DD
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  throw new Error('Pass the draft date as YYYY-MM-DD');
}

const root = process.cwd();
const tmp = path.join(root, 'tmp');
const drafts = JSON.parse(fs.readFileSync(path.join(tmp, `burger-copy-drafts-${date}.json`), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(path.join(tmp, `burger-configurations-${date}.json`), 'utf8'));
const sourceByHandle = new Map(inventory.map((item) => [item.handle, item]));
const fields = ['titleUa', 'titleEn', 'shortUa', 'shortEn', 'descUa', 'descEn'];
const usedTitles = new Set();
const usedMeta = new Set();
const results = [];

function plain(html) {
  return String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

for (const [handle, draft] of Object.entries(drafts)) {
  const source = sourceByHandle.get(handle);
  const issues = [];
  if (!source) issues.push('NO_SUPPLIER_PRODUCT');
  if (draft.sourceUrl !== `https://burgertuning.com/products/${handle}`) {
    issues.push('SOURCE_URL_MISMATCH');
  }
  for (const field of fields) {
    if (!String(draft[field] ?? '').trim()) issues.push(`EMPTY_${field}`);
  }
  for (const locale of ['Ua', 'En']) {
    const title = String(draft[`title${locale}`] ?? '').trim();
    const meta = String(draft[`short${locale}`] ?? '').trim();
    const body = String(draft[`desc${locale}`] ?? '');
    const titleKey = `${locale}:${title.toLowerCase()}`;
    const metaKey = `${locale}:${meta.toLowerCase()}`;
    if (usedTitles.has(titleKey)) issues.push(`DUPLICATE_TITLE_${locale}`);
    if (usedMeta.has(metaKey)) issues.push(`DUPLICATE_META_${locale}`);
    usedTitles.add(titleKey);
    usedMeta.add(metaKey);
    if (meta.length > 165) issues.push(`META_TRUNCATES_IN_THIS_APP_${locale}`);
    if (plain(body).length < 240) issues.push(`THIN_BODY_${locale}`);
    if ((body.match(/<h3\b/g) ?? []).length < 2) issues.push(`MISSING_SECTION_HEADINGS_${locale}`);
    if (/<script|<iframe|onerror=|onclick=/i.test(body)) issues.push(`UNSAFE_HTML_${locale}`);
  }
  if (!/(?:дає|додає|змінює|коригує|регулює|допомага|потрібн|для чого|наддув|потуж|налаштов|контрол|монітор|зчиту|підключ|підвищ|замін|вимірю|подач|забезпеч|логув|перемикан|збільш|потік|відгук|зменш|покращ|звук|полегш|актив|збира|відокрем|відділя|очищ|захищ)/i.test(draft.descUa)) {
    issues.push('NO_VISIBLE_UA_BENEFIT_EXPLANATION');
  }
  if (!/(?:does|adds|change|helps|enables|why|boost|tun(?:e|ing)|control|monitor|connect|adjust|support|replace|provide|read|display|switch|log|increase|improve|flow|fit|install|map|collect|separat|protect|capture)/i.test(draft.descEn)) {
    issues.push('NO_VISIBLE_EN_BENEFIT_EXPLANATION');
  }
  if ((source?.variants?.length ?? 0) > 1 &&
      !/(?:обер|обир|вибран|опці|версі|конфігурац|селектор)/i.test(draft.descUa)) {
    issues.push('VARIANT_SCOPE_NOT_EXPLAINED_UA');
  }
  if ((source?.variants?.length ?? 0) > 1 &&
      !/(?:choose|select|option|variant|configuration)/i.test(draft.descEn)) {
    issues.push('VARIANT_SCOPE_NOT_EXPLAINED_EN');
  }
  results.push({ handle, productType: source?.productType ?? '', variants: source?.variants?.length ?? 0,
    issues });
}

const summary = {
  supplierProducts: inventory.length,
  draftedProducts: results.length,
  passed: results.filter((row) => row.issues.length === 0).length,
  flagged: results.filter((row) => row.issues.length > 0),
};
summary.completeCoverage = summary.draftedProducts === summary.supplierProducts;
summary.readyForImport = summary.completeCoverage && summary.flagged.length === 0;
const output = path.join(tmp, `burger-copy-validation-${date}.json`);
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ supplierProducts: summary.supplierProducts,
  draftedProducts: summary.draftedProducts, passed: summary.passed,
  completeCoverage: summary.completeCoverage, readyForImport: summary.readyForImport,
  flagged: summary.flagged, output }, null, 2));
if (process.argv.includes('--require-complete') && !summary.readyForImport) process.exitCode = 1;
