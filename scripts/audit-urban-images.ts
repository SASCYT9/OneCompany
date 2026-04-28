/**
 * Audit Urban product card images to flag mismatches by bucket.
 * Bucket definitions:
 *   - missing       — empty / placeholder image
 *   - cross-vehicle — image not compatible with the product's collection model
 *   - blueprint     — blueprint / technical drawing instead of a photo
 *   - generic-carousel — model carousel kit-shot used as if it were a product photo
 *   - role-mismatch — intent (rear/front/side/detail) does not match image role
 *   - ok            — passes all checks
 *
 * Run:
 *   npx tsx scripts/audit-urban-images.ts > tmp/audit-urban-images.tsv
 *   npx tsx scripts/audit-urban-images.ts --collection=mercedes-g-wagon-w465-widetrack
 *   npx tsx scripts/audit-urban-images.ts --bucket=cross-vehicle,role-mismatch
 */

import { getShopProductsServer } from '../src/lib/shopCatalogServer';
import {
  getUrbanCatalogProducts,
  getUrbanCollectionHandleForProduct,
} from '../src/lib/urbanCollectionMatcher';
import {
  classifyUrbanCollectionImageRole,
  isUrbanBlueprintImage,
  isUrbanGenericCarouselImage,
  isUrbanImageCompatibleWithModel,
  isUrbanPlaceholderImage,
} from '../src/lib/urbanImageUtils';
import { resolveUrbanCardVisualIntent } from '../src/lib/urbanVisualIntent';
import { URBAN_COLLECTION_CARDS } from '../src/app/[locale]/shop/data/urbanCollectionsList';

type Bucket = 'missing' | 'cross-vehicle' | 'blueprint' | 'generic-carousel' | 'role-mismatch' | 'ok';

const ALL_BUCKETS: Bucket[] = ['missing', 'cross-vehicle', 'blueprint', 'generic-carousel', 'role-mismatch', 'ok'];

function parseFlag(name: string): string | null {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return null;
}

function intentMatchesImageRole(intent: string, role: string): boolean {
  if (intent === 'package') return role === 'hero' || role === 'front' || role === 'neutral';
  if (intent === 'front') return role === 'front' || role === 'hero' || role === 'neutral';
  if (intent === 'rear') return role === 'rear' || role === 'neutral';
  if (intent === 'side') return role === 'side' || role === 'neutral';
  if (intent === 'detail') return role === 'detail' || role === 'neutral' || role === 'hero';
  return true;
}

async function main() {
  const allProducts = await getShopProductsServer();
  const urbanProducts = getUrbanCatalogProducts(allProducts);

  const collectionFilter = parseFlag('collection');
  const bucketFilter = parseFlag('bucket')?.split(',').map((s) => s.trim());
  const printOk = process.argv.includes('--include-ok');

  const counts: Record<string, Record<Bucket, number>> = {};
  const rows: Array<{
    handle: string;
    slug: string;
    sku: string;
    title: string;
    category: string;
    intent: string;
    role: string;
    bucket: Bucket;
    image: string;
  }> = [];

  for (const product of urbanProducts) {
    const handle = getUrbanCollectionHandleForProduct(product);
    if (!handle) continue;
    if (collectionFilter && handle !== collectionFilter) continue;

    const image = String(product.image ?? '').trim();
    const intent = resolveUrbanCardVisualIntent(product);
    const role = image ? classifyUrbanCollectionImageRole(image) : 'missing';

    let bucket: Bucket;
    if (!image || isUrbanPlaceholderImage(image)) {
      bucket = 'missing';
    } else if (!isUrbanImageCompatibleWithModel(image, [handle])) {
      bucket = 'cross-vehicle';
    } else if (isUrbanBlueprintImage(image)) {
      bucket = 'blueprint';
    } else if (isUrbanGenericCarouselImage(image)) {
      bucket = 'generic-carousel';
    } else if (!intentMatchesImageRole(intent, role)) {
      bucket = 'role-mismatch';
    } else {
      bucket = 'ok';
    }

    if (!counts[handle]) {
      counts[handle] = { missing: 0, 'cross-vehicle': 0, blueprint: 0, 'generic-carousel': 0, 'role-mismatch': 0, ok: 0 };
    }
    counts[handle][bucket] += 1;

    if (bucket === 'ok' && !printOk) continue;
    if (bucketFilter && !bucketFilter.includes(bucket)) continue;

    rows.push({
      handle,
      slug: product.slug,
      sku: product.sku,
      title: product.title.en || product.title.ua || '',
      category: product.category.en || product.category.ua || '',
      intent,
      role,
      bucket,
      image,
    });
  }

  rows.sort((a, b) => a.handle.localeCompare(b.handle) || a.bucket.localeCompare(b.bucket) || a.slug.localeCompare(b.slug));

  // TSV
  console.log(['handle', 'slug', 'sku', 'category', 'intent', 'role', 'bucket', 'title', 'image'].join('\t'));
  for (const r of rows) {
    console.log([r.handle, r.slug, r.sku, r.category, r.intent, r.role, r.bucket, r.title, r.image].join('\t'));
  }

  // Summary on stderr so it doesn't pollute the TSV
  console.error('\n=== AUDIT SUMMARY ===');
  const totals: Record<Bucket, number> = { missing: 0, 'cross-vehicle': 0, blueprint: 0, 'generic-carousel': 0, 'role-mismatch': 0, ok: 0 };
  const handles = Object.keys(counts).sort((a, b) => {
    const cardA = URBAN_COLLECTION_CARDS.find((c) => c.collectionHandle === a);
    const cardB = URBAN_COLLECTION_CARDS.find((c) => c.collectionHandle === b);
    return (cardA?.brand || '').localeCompare(cardB?.brand || '') || a.localeCompare(b);
  });

  for (const handle of handles) {
    const total = ALL_BUCKETS.reduce((sum, b) => sum + counts[handle][b], 0);
    const buckets = ALL_BUCKETS.map((b) => `${b}=${counts[handle][b]}`).filter((s) => !s.endsWith('=0')).join(' ');
    console.error(`${handle.padEnd(45)} total=${total} ${buckets}`);
    ALL_BUCKETS.forEach((b) => { totals[b] += counts[handle][b]; });
  }

  console.error('\n--- TOTALS ---');
  ALL_BUCKETS.forEach((b) => console.error(`  ${b.padEnd(20)} ${totals[b]}`));
  const grand = ALL_BUCKETS.reduce((sum, b) => sum + totals[b], 0);
  console.error(`  ${'GRAND TOTAL'.padEnd(20)} ${grand}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
