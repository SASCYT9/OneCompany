#!/usr/bin/env node
/*
 * Refactors shop server pages so they no longer call
 * `getCurrentShopCustomerSession()`. They render with an anonymous viewer
 * context (the live B2B-aware context is hydrated client-side via
 * `useShopViewerContext`). Adds `export const revalidate = 3600`.
 *
 * Idempotent.
 *
 * Usage:
 *   node scripts/anonymize-shop-pages.mjs            (dry-run)
 *   node scripts/anonymize-shop-pages.mjs --commit
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const COMMIT = process.argv.includes('--commit');
const FILES = [
  'src/app/[locale]/shop/[slug]/page.tsx',
  'src/app/[locale]/shop/adro/collections/[handle]/page.tsx',
  'src/app/[locale]/shop/adro/collections/page.tsx',
  'src/app/[locale]/shop/brabus/collections/[handle]/page.tsx',
  'src/app/[locale]/shop/brabus/products/page.tsx',
  'src/app/[locale]/shop/burger/products/page.tsx',
  'src/app/[locale]/shop/do88/collections/[handle]/page.tsx',
  'src/app/[locale]/shop/girodisc/catalog/page.tsx',
  'src/app/[locale]/shop/ipe/collections/page.tsx',
  'src/app/[locale]/shop/ohlins/catalog/page.tsx',
  'src/app/[locale]/shop/racechip/catalog/page.tsx',
  'src/app/[locale]/shop/racechip/products/[slug]/page.tsx',
  // turn14: skipped — legitimately dynamic (per-customer markup on server).
  'src/app/[locale]/shop/urban/collections/[handle]/page.tsx',
  'src/app/[locale]/shop/urban/products/page.tsx',
];

let changed = 0, skipped = 0, failed = 0;
for (const rel of FILES) {
  const file = path.resolve(process.cwd(), rel);
  let src;
  try { src = await fs.readFile(file, 'utf8'); }
  catch { console.warn(`! missing  ${rel}`); failed++; continue; }

  if (!src.includes('getCurrentShopCustomerSession')) {
    console.log(`= already   ${rel}`);
    skipped++;
    continue;
  }

  // 1. Drop the session import line.
  src = src.replace(
    /import\s*\{\s*getCurrentShopCustomerSession\s*\}\s*from\s*['"][^'"]+['"];?\s*\r?\n/,
    ''
  );

  // 2. Strip the session call from any Promise.all and from the destructuring.
  //    Targeted, idempotent string surgeries instead of one giant regex.
  src = src.replace(/^\s*getCurrentShopCustomerSession\(\)\s*,?\s*\r?\n/m, '');
  src = src.replace(/\bsession\s*,\s*/, '');                // destructure: [session, x, y] -> [x, y]
  src = src.replace(/const\s+session\s*=\s*await\s+getCurrentShopCustomerSession\(\);\s*\r?\n/, '');

  // 3. Anonymize buildShopViewerPricingContext arguments that referenced session.
  src = src.replace(/session\?\.group\s*\?\?\s*null/g, 'null');
  src = src.replace(/Boolean\(session\)/g, 'false');
  src = src.replace(/session\?\.b2bDiscountPercent\s*\?\?\s*null/g, 'null');

  // 4. Add `export const revalidate = 3600;` after the last import.
  //    Multi-line imports counted: track `import {` open and `} from '...'` close.
  if (!/export\s+const\s+revalidate\s*=/.test(src)) {
    const lines = src.split('\n');
    let lastImportIdx = -1;
    let inMultilineImport = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (inMultilineImport) {
        if (/from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) {
          lastImportIdx = i;
          inMultilineImport = false;
        }
        continue;
      }
      if (/^\s*import\s/.test(line)) {
        if (/from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) {
          lastImportIdx = i;
        } else {
          inMultilineImport = true;
        }
      }
    }
    if (lastImportIdx >= 0) {
      lines.splice(
        lastImportIdx + 1,
        0,
        '',
        '// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.',
        'export const revalidate = 3600;'
      );
      src = lines.join('\n');
    }
  }

  // Sanity: bail if any session.* references remain.
  if (/\bsession\?\.|getCurrentShopCustomerSession/.test(src)) {
    console.warn(`! lingering session refs in  ${rel}`);
    failed++;
    continue;
  }

  if (COMMIT) await fs.writeFile(file, src);
  console.log(`+ refactored  ${rel}`);
  changed++;
}

console.log(`\nchanged=${changed} skipped=${skipped} failed=${failed}`);
if (!COMMIT) console.log('(dry-run — pass --commit to write)');
