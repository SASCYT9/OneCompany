// Generate review-only page-specific meta candidates from existing localized
// product copy. Never writes the catalog or treats a truncated sentence as final.
// Run: node scripts/build-burger-meta-candidates.mjs YYYY-MM-DD
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  throw new Error('Pass the snapshot date as YYYY-MM-DD');
}
const root = process.cwd();
const tmp = path.join(root, 'tmp');
const products = JSON.parse(fs.readFileSync(
  path.join(tmp, 'burger-local-preview-original.json'), 'utf8'
));
const source = JSON.parse(fs.readFileSync(
  path.join(tmp, `burger-configurations-${date}.json`), 'utf8'
));
const bySlug = new Map(products.map((product) => [product.slug, product]));

function plain(text) {
  return String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function candidate(value) {
  const clean = plain(value);
  if (!clean) return { text: '', status: 'MISSING' };
  if (clean.length <= 155) return { text: clean, status: 'FULL_SENTENCE_REVIEW' };
  const slice = clean.slice(0, 155);
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (sentenceEnd >= 75) {
    return { text: clean.slice(0, sentenceEnd + 1), status: 'FIRST_SENTENCE_REVIEW' };
  }
  // Show a useful start for the editor, but flag it as incomplete.
  const wordEnd = slice.lastIndexOf(' ');
  return { text: clean.slice(0, wordEnd > 80 ? wordEnd : 155), status: 'NEEDS_EDITOR_REWRITE' };
}

const rows = source.map((product) => {
  const current = bySlug.get(`burger-${product.handle}`);
  const ua = candidate(current?.shortDescription?.ua);
  const en = candidate(current?.shortDescription?.en);
  return {
    handle: product.handle,
    sourceUrl: product.sourceUrl,
    productType: product.productType,
    titleUa: current?.title?.ua ?? '',
    titleEn: current?.title?.en ?? '',
    candidateUa: ua.text,
    uaStatus: ua.status,
    candidateEn: en.text,
    enStatus: en.status,
  };
});

for (const locale of ['Ua', 'En']) {
  const count = new Map();
  for (const row of rows) {
    const key = row[`candidate${locale}`].toLowerCase();
    if (key) count.set(key, (count.get(key) ?? 0) + 1);
  }
  for (const row of rows) {
    const key = row[`candidate${locale}`].toLowerCase();
    if (key && count.get(key) > 1) row[`${locale.toLowerCase()}Status`] += '|DUPLICATE_CANDIDATE';
  }
}

const headers = Object.keys(rows[0] ?? {});
const esc = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [headers.join(','), ...rows.map((row) =>
  headers.map((header) => esc(row[header])).join(','))].join('\n');
const output = path.join(tmp, `burger-meta-candidates-${date}.csv`);
fs.writeFileSync(output, `\uFEFF${csv}\n`, 'utf8');
const statuses = Object.fromEntries(['Ua', 'En'].map((locale) => [locale, Object.fromEntries(
  [...new Set(rows.map((row) => row[`${locale.toLowerCase()}Status`]))].map((status) => [
    status, rows.filter((row) => row[`${locale.toLowerCase()}Status`] === status).length,
  ])
)]));
console.log(JSON.stringify({ products: rows.length, statuses, output }, null, 2));
