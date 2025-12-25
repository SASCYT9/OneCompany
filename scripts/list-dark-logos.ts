import fs from 'node:fs';
import path from 'node:path';

import { DARK_LOGOS } from '../src/lib/darkLogos';

function parseArgs(argv: string[]) {
  const args = new Set(argv);
  return {
    showAll: args.has('--all'),
    showMissing: args.has('--missing'),
    showExisting: args.has('--existing'),
  };
}

function groupByExtension(fileNames: string[]) {
  const map = new Map<string, number>();
  for (const name of fileNames) {
    const ext = path.extname(name).toLowerCase() || '(none)';
    map.set(ext, (map.get(ext) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function main() {
  const { showAll, showMissing, showExisting } = parseArgs(process.argv.slice(2));

  const logosDir = path.join(process.cwd(), 'public', 'logos');

  const existing: string[] = [];
  const missing: string[] = [];

  for (const fileName of DARK_LOGOS as string[]) {
    const fullPath = path.join(logosDir, fileName);
    if (fs.existsSync(fullPath)) {
      existing.push(fileName);
    } else {
      missing.push(fileName);
    }
  }

  const extStats = groupByExtension(DARK_LOGOS as string[]);

  // Summary
  console.log(`DARK_LOGOS entries: ${DARK_LOGOS.length}`);
  console.log(`Existing in public/logos: ${existing.length}`);
  console.log(`Missing from public/logos: ${missing.length}`);
  console.log('By extension (top):');
  for (const [ext, count] of extStats.slice(0, 10)) {
    console.log(`  ${ext}: ${count}`);
  }

  // Lists
  const shouldPrintList = showAll || showMissing || showExisting;
  if (!shouldPrintList) {
    console.log('\nTip: use --missing, --existing, or --all to print lists.');
    console.log('Example: npx tsx scripts/list-dark-logos.ts --missing');
    return;
  }

  if (showAll) {
    console.log('\n--- DARK_LOGOS (all) ---');
    for (const name of DARK_LOGOS as string[]) console.log(name);
  }

  if (showExisting) {
    console.log('\n--- DARK_LOGOS (existing) ---');
    for (const name of existing) console.log(name);
  }

  if (showMissing) {
    console.log('\n--- DARK_LOGOS (missing) ---');
    for (const name of missing) console.log(name);
  }
}

main();
