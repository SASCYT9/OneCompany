/**
 * Extract iPE Shopify variant→featuredImage and gallery image alts from
 * official-snapshot.json, so we can map filename→caption without looking
 * at the actual photos.
 */
import { readFileSync } from 'node:fs';

const snapshotPath = process.argv[2] || 'artifacts/ipe-import/2026-05-02T14-44-33-838Z/official-snapshot.json';
const handleArg = process.argv[3];
if (!handleArg) {
  console.log('usage: npx tsx scripts/extract-ipe-snapshot.ts <snapshot-path> <handle>');
  process.exit(1);
}

const snap = JSON.parse(readFileSync(snapshotPath, 'utf-8')) as {
  products: Array<{
    handle: string;
    title: string;
    images: string[];
    variants: Array<{
      title: string;
      optionValues: string[];
      featuredImage: string | null;
    }>;
  }>;
};

const product = snap.products.find((p) => p.handle === handleArg);
if (!product) {
  console.log(`handle '${handleArg}' not in snapshot`);
  console.log('Available handles (first 20):');
  for (const p of snap.products.slice(0, 20)) console.log(`  ${p.handle}`);
  process.exit(1);
}

console.log(`# ${product.title} (${product.handle})`);
console.log(`\n## Gallery (${product.images.length})`);
for (const [i, src] of product.images.entries()) {
  console.log(`  ${String(i + 1).padStart(2, '0')}: ${src}`);
}
console.log(`\n## Variants (${product.variants.length})`);
for (const v of product.variants) {
  const fi = v.featuredImage ?? '(no featuredImage)';
  console.log(`  [${v.optionValues.join(' | ')}]`);
  console.log(`     ${v.title}`);
  console.log(`     featuredImage: ${fi}`);
}
