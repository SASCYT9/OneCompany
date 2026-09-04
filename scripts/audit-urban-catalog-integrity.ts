/** Checks every current Urban product, collection membership and media URL, read-only. */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getShopProductsServer } from '../src/lib/shopCatalogServer';
import { getUrbanCatalogProducts, getProductsForUrbanCollection } from '../src/lib/urbanCollectionMatcher';
import { isUrbanPlaceholderImage } from '../src/lib/urbanImageUtils';
import { URBAN_COLLECTION_CARDS } from '../src/app/[locale]/shop/data/urbanCollectionsList';

async function main() {
  const all = await getShopProductsServer();
  const products = getUrbanCatalogProducts(all);
  let missingSourceSlugs: string[] = [];
  if (process.env.SHOP_LOCAL_CATALOG_SNAPSHOT === '1') {
    const manifest = JSON.parse(await readFile('public/catalog-fallback/manifest.json', 'utf8'));
    const file = manifest.stores.urban.file;
    if (!/^urban\.[a-z0-9]+\.json$/i.test(file)) throw new Error('Invalid Urban snapshot filename');
    const source: Array<{ slug: string }> = JSON.parse(await readFile(path.join('public/catalog-fallback', file), 'utf8'));
    const current = new Set(products.map(p => p.slug));
    missingSourceSlugs = source.filter(p => !current.has(p.slug)).map(p => p.slug);
  }
  const collections = URBAN_COLLECTION_CARDS.map(card => ({
    handle: card.collectionHandle,
    slugs: getProductsForUrbanCollection(products, card.collectionHandle, card.title, card.brand).map(p => p.slug),
  }));
  const covered = new Set(collections.flatMap(c => c.slugs));
  const urls = [...new Set(products.flatMap(p => [p.image, ...(p.gallery ?? [])]).filter(Boolean))];
  const failures: Array<{ url: string; reason: string; slugs: string[] }> = [];
  const checkRemote = process.argv.includes('--check-urls');
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      let reason = '';
      if (isUrbanPlaceholderImage(url)) reason = 'placeholder';
      else if (url.startsWith('/')) {
        const file = path.resolve('public', `.${url.split(/[?#]/)[0]}`);
        if (!file.startsWith(path.resolve('public') + path.sep)) reason = 'invalid-local-path';
        else try { await access(file); } catch { reason = 'local-file-missing'; }
      } else if (checkRemote && /^https:\/\//.test(url)) {
        try {
          const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
          if (!response.ok) reason = `HTTP ${response.status}`;
          else if (!response.headers.get('content-type')?.startsWith('image/')) reason = 'not-an-image';
        } catch (error) { reason = `${String(error)}: ${error instanceof Error ? String(error.cause ?? '') : ''}`; }
      }
      if (reason) failures.push({ url, reason, slugs: products.filter(p => p.image === url || p.gallery?.includes(url)).map(p => p.slug) });
    }
  }));
  const report = {
    checkedAt: new Date().toISOString(), totalShopProducts: all.length, urbanProducts: products.length,
    checkedRemote: checkRemote, uniqueMediaUrls: urls.length,
    missingSourceSlugs,
    orphanSlugs: products.filter(p => !covered.has(p.slug)).map(p => p.slug), collections, failures,
  };
  await mkdir('tmp/urban-source-media', { recursive: true });
  await writeFile('tmp/urban-source-media/integrity.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, collections: collections.map(c => ({ handle: c.handle, count: c.slugs.length })), failures: failures.length, examples: failures.slice(0, 3) }, null, 2));
  if (report.orphanSlugs.length || missingSourceSlugs.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
