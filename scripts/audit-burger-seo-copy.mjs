// Read-only editorial inventory for all Burger products, including tuner families.
// Run after supplier snapshot: node scripts/audit-burger-seo-copy.mjs YYYY-MM-DD
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  throw new Error('Pass the supplier snapshot date as YYYY-MM-DD');
}

const root = process.cwd();
const tmp = path.join(root, 'tmp');
const pages = fs.readdirSync(tmp)
  .filter((name) => name.startsWith(`burger-products-${date}-page`) && name.endsWith('.json'))
  .sort((a, b) => Number(a.match(/page(\d+)/)?.[1]) - Number(b.match(/page(\d+)/)?.[1]));
if (!pages.length) throw new Error(`No supplier snapshot for ${date}`);
const supplier = pages.flatMap((file) =>
  JSON.parse(fs.readFileSync(path.join(tmp, file), 'utf8')).products ?? []
);
const localBackup = path.join(tmp, 'burger-local-preview-original.json');
if (!fs.existsSync(localBackup)) throw new Error('Missing unmodified local catalog backup');
const local = JSON.parse(fs.readFileSync(localBackup, 'utf8'));
const localBySlug = new Map(local.map((product) => [product.slug, product]));

function plain(html) {
  const $ = load(String(html ?? ''));
  $('script, style, noscript').remove();
  return $.root().text()
    .replace(/&(?:nbsp|amp|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const rows = supplier.map((product) => {
    const current = localBySlug.get(`burger-${product.handle}`);
    const enSource = plain(product.body_html);
    const uaCurrent = plain(current?.longDescription?.ua);
    const enCurrent = plain(current?.longDescription?.en);
    const options = (product.options ?? []).filter((option) =>
      option.name !== 'Title' && option.values?.some((value) => value !== 'Default Title')
    );
    const flags = [];
    if (!current) flags.push('NOT_IN_LOCAL_CATALOG');
    if (!enSource) flags.push('NO_SUPPLIER_DESCRIPTION');
    if (!uaCurrent) flags.push('NO_UA_DESCRIPTION');
    if (uaCurrent && uaCurrent.length < 200) flags.push('THIN_UA_DESCRIPTION');
    if (options.length && /\b(?:includes?|included|complete kit|all our|with or without)\b/i.test(enSource)) {
      flags.push('VARIANT_SCOPE_REVIEW');
    }
    if (/\b(?:\d+\s*(?:whp|hp|horsepower)|\d+%)\b/i.test(enSource)) {
      flags.push('NUMERIC_PERFORMANCE_CLAIM_REVIEW');
    }
    if (/\b(?:free shipping|discount|coupon|sale price)\b/i.test(enSource)) {
      flags.push('SUPPLIER_PROMOTION_COPY');
    }
    return {
      handle: product.handle,
      sourceUrl: `https://burgertuning.com/products/${product.handle}`,
      localUrl: `https://onecompany.global/ua/shop/burger/products/burger-${product.handle}`,
      productType: product.product_type,
      supplierTitle: product.title,
      variantCount: product.variants?.length ?? 0,
      optionCount: options.length,
      sourceDescriptionChars: enSource.length,
      currentUaTitle: current?.title?.ua ?? '',
      currentUaShort: plain(current?.shortDescription?.ua),
      currentUaLongChars: uaCurrent.length,
      currentEnLongChars: enCurrent.length,
      sourceExcerpt: enSource.slice(0, 300),
      flags: flags.join('|'),
    };
  });

const headers = Object.keys(rows[0] ?? {});
const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [headers.join(','), ...rows.map((row) =>
  headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
const output = path.join(tmp, `burger-seo-copy-audit-${date}.csv`);
fs.writeFileSync(output, `\uFEFF${csv}\n`, 'utf8');
const flagCounts = Object.fromEntries(
  [...new Set(rows.flatMap((row) => row.flags.split('|').filter(Boolean)))].map((flag) => [
    flag, rows.filter((row) => row.flags.split('|').includes(flag)).length,
  ])
);
const summary = { products: rows.length, flags: flagCounts, output };
fs.writeFileSync(path.join(tmp, `burger-seo-copy-audit-${date}.json`),
  JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
