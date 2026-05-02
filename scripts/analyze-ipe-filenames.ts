/**
 * Pull all iPE gallery image filenames from the snapshot, group them by
 * pattern, and print frequencies. This shows what classifiers are worth
 * building (e.g. "iPECatbackSystem", "iPETip", "tip", "adapter").
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dirs = readdirSync(path.join(process.cwd(), 'artifacts', 'ipe-import'), {
  withFileTypes: true,
}).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse();
let snapshotPath = '';
for (const d of dirs) {
  const candidate = path.join(process.cwd(), 'artifacts', 'ipe-import', d, 'official-snapshot.json');
  try {
    readFileSync(candidate);
    snapshotPath = candidate;
    break;
  } catch {}
}
if (!snapshotPath) throw new Error('No snapshot');
console.log(`Snapshot: ${snapshotPath}\n`);
const snap = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

const tokens = new Map<string, number>();
const filenames: string[] = [];
for (const p of snap.products) {
  for (const url of p.images ?? []) {
    const file = (url.split('/').pop() ?? url).split('?')[0];
    filenames.push(file);
    // tokenize on common separators and capital boundaries
    const lower = file.toLowerCase().replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
    const tks = lower.split(/[-_\s.]+/).filter(Boolean);
    for (const t of tks) {
      if (/^\d+$/.test(t)) continue;
      if (t.length < 3) continue;
      tokens.set(t, (tokens.get(t) ?? 0) + 1);
    }
  }
}

// Show meaningful (non-numeric, non-uuid) tokens sorted by frequency
const interesting = [...tokens.entries()]
  .filter(([t]) => !/^[a-f0-9]{6,}$/.test(t)) // skip uuid hex blobs
  .sort((a, b) => b[1] - a[1])
  .slice(0, 60);
console.log('Top filename tokens:');
for (const [t, c] of interesting) console.log(`  ${c.toString().padStart(4)}  ${t}`);

console.log(`\nTotal unique filenames: ${new Set(filenames).size} / ${filenames.length}`);

// Examples of "tip|adapter|midpipe" matches
console.log('\nTip/adapter/component close-ups (sample):');
for (const f of filenames) {
  if (/tips?|carbon|cf[-_]tips?|adapter|midpipe|mid[-_]pipe|x[-_]?pipe/i.test(f)) {
    console.log(`  ${f}`);
  }
}
