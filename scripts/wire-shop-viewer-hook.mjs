#!/usr/bin/env node
/*
 * Wires `useShopViewerContext` into shop client components that currently
 * accept `viewerContext` as a prop. Idempotent: skips files already wired.
 *
 * Transformation:
 *   1. Adds `import { useShopViewerContext } from '@/lib/useShopViewerContext';`
 *   2. Renames the destructured prop `viewerContext` → `viewerContext: ssrViewerContext`
 *   3. Inserts `const viewerContext = useShopViewerContext(ssrViewerContext);`
 *      as the first line of the function body (so all downstream usages are
 *      live, B2B-aware after hydration).
 *
 * Usage:
 *   node scripts/wire-shop-viewer-hook.mjs            (dry-run)
 *   node scripts/wire-shop-viewer-hook.mjs --commit
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const COMMIT = process.argv.includes('--commit');
const FILES = [
  'src/app/[locale]/shop/components/AdroCatalogGrid.tsx',
  'src/app/[locale]/shop/components/AdroCollectionProductGrid.tsx',
  'src/app/[locale]/shop/components/BrabusCollectionProductGrid.tsx',
  'src/app/[locale]/shop/components/BrabusShopProductDetailLayout.tsx',
  'src/app/[locale]/shop/components/BrabusVehicleFilter.tsx',
  'src/app/[locale]/shop/components/BurgerShopProductDetailLayout.tsx',
  'src/app/[locale]/shop/components/BurgerVehicleFilter.tsx',
  'src/app/[locale]/shop/components/Do88CollectionProductGrid.tsx',
  'src/app/[locale]/shop/components/GirodiscVehicleFilter.tsx',
  'src/app/[locale]/shop/components/IpeVehicleFilter.tsx',
  'src/app/[locale]/shop/components/OhlinsVehicleFilter.tsx',
  'src/app/[locale]/shop/components/RacechipShopProductDetailLayout.tsx',
  'src/app/[locale]/shop/components/RacechipVehicleFilter.tsx',
  'src/app/[locale]/shop/components/ShopProductDetailPage.tsx',
  'src/app/[locale]/shop/components/UrbanCollectionProductGrid.tsx',
  'src/app/[locale]/shop/components/UrbanVehicleFilter.tsx',
];

let changedCount = 0, skippedCount = 0, failedCount = 0;
for (const rel of FILES) {
  const file = path.resolve(process.cwd(), rel);
  let src;
  try {
    src = await fs.readFile(file, 'utf8');
  } catch {
    console.warn(`! missing  ${rel}`);
    failedCount++;
    continue;
  }

  if (src.includes('useShopViewerContext')) {
    console.log(`= already   ${rel}`);
    skippedCount++;
    continue;
  }

  // Skip server components — useShopViewerContext is a client-only hook.
  const headSnippet = src.split('\n').slice(0, 3).join('\n');
  if (!/['"]use client['"]/.test(headSnippet)) {
    console.warn(`= server   ${rel} (no 'use client' directive)`);
    skippedCount++;
    continue;
  }

  // 1. Add import after the existing shopPricingAudience import line.
  const importRegex = /(import [^;]*from ['"]@\/lib\/shopPricingAudience['"];)/;
  if (!importRegex.test(src)) {
    console.warn(`! no shopPricingAudience import in  ${rel}`);
    failedCount++;
    continue;
  }
  src = src.replace(
    importRegex,
    `$1\nimport { useShopViewerContext } from "@/lib/useShopViewerContext";`
  );

  // 2. Rename viewerContext inside the props destructuring (between `({ ... })`).
  //    We only target the first destructuring of the default-exported function.
  const exportFnRegex = /(export\s+(?:default\s+)?function\s+[A-Za-z0-9_]+\s*\()([\s\S]*?)(\))/;
  const fnMatch = src.match(exportFnRegex);
  if (!fnMatch) {
    console.warn(`! cannot find exported function in  ${rel}`);
    failedCount++;
    continue;
  }
  const propsBlock = fnMatch[2];
  if (!/\bviewerContext\b/.test(propsBlock)) {
    console.warn(`! viewerContext not in props destructure in  ${rel}`);
    failedCount++;
    continue;
  }
  const renamedProps = propsBlock.replace(/\bviewerContext\b/, 'viewerContext: ssrViewerContext');
  src = src.replace(fnMatch[0], `${fnMatch[1]}${renamedProps}${fnMatch[3]}`);

  // 3. Insert hook call at top of function body. We look for a body-opening
  // brace just after the props block on the default export.
  // Pattern: `}: SomethingProps) {\n` then any number of blank/comment lines.
  const bodyOpenRegex = /(\}:\s*[A-Za-z0-9_]+(?:Props)?\)\s*\{\r?\n)/;
  if (!bodyOpenRegex.test(src)) {
    // Try generic "function foo({...}) {" without Props type annotation.
    const altRegex = /(\)\s*\{\r?\n)(?=\s+(?:const|let|var|return|\/\/|\/\*))/;
    if (!altRegex.test(src)) {
      console.warn(`! cannot locate function body in  ${rel}`);
      failedCount++;
      continue;
    }
    src = src.replace(
      altRegex,
      `$1  const viewerContext = useShopViewerContext(ssrViewerContext);\n`
    );
  } else {
    src = src.replace(
      bodyOpenRegex,
      `$1  const viewerContext = useShopViewerContext(ssrViewerContext);\n`
    );
  }

  if (COMMIT) {
    await fs.writeFile(file, src);
  }
  console.log(`+ wired     ${rel}`);
  changedCount++;
}

console.log(`\nchanged=${changedCount} skipped=${skippedCount} failed=${failedCount}`);
if (!COMMIT) console.log('(dry-run — pass --commit to write)');
