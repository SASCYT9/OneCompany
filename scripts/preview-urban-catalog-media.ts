/** Contact sheets of the current catalog, for visual QA. Does not edit storefront assets. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getUrbanVerifiedProductMedia } from '../src/lib/urbanVerifiedProductMedia';
import { getShopProductsServer } from '../src/lib/shopCatalogServer';
import { getUrbanCatalogProducts } from '../src/lib/urbanCollectionMatcher';

async function main() {
  const products = getUrbanCatalogProducts(await getShopProductsServer());
  const dir = 'tmp/urban-source-media/catalog';
  await mkdir(dir, { recursive: true });
  const missing: string[] = [];
  const rows = products.sort((a: { sku: string }, b: { sku: string }) => a.sku.localeCompare(b.sku));
  await writeFile(`${dir}/index.json`, JSON.stringify(rows.map((p: { sku: string; title: { en: string } }, index: number) => ({ number: index + 1, sku: p.sku, title: p.title.en })), null, 2));
  for (let page = 0; page * 20 < rows.length; page++) {
    const cells = await Promise.all(rows.slice(page * 20, page * 20 + 20).map(async (p: { sku: string; image: string; title: { en: string } }, index: number) => {
      const url = getUrbanVerifiedProductMedia(p.sku)?.image ?? p.image;
      let input: Buffer;
      try {
        const bytes = url.startsWith('/') ? await readFile(path.join('public', url)) : await fetch(url, { signal: AbortSignal.timeout(20000) }).then(async r => {
          if (!r.ok) throw new Error(`${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        });
        input = await sharp(bytes).resize(300, 230, { fit: 'contain', background: '#fff' }).png().toBuffer();
      } catch { missing.push(p.sku); input = await sharp({ create: { width: 300, height: 230, channels: 3, background: '#ddd' } }).png().toBuffer(); }
      const label = `${page * 20 + index + 1}. ${p.sku}`;
      const title = p.title.en.slice(0, 41).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const text = Buffer.from(`<svg width="300" height="50"><rect width="300" height="50" fill="white"/><text x="5" y="18" font-size="13">${label}</text><text x="5" y="37" font-size="11">${title}</text></svg>`);
      return [{ input, left: (index % 4) * 300, top: Math.floor(index / 4) * 280 }, { input: text, left: (index % 4) * 300, top: Math.floor(index / 4) * 280 + 230 }];
    }));
    await sharp({ create: { width: 1200, height: 1400, channels: 3, background: '#ddd' } }).composite(cells.flat()).jpeg().toFile(`${dir}/sheet-${page + 1}.jpg`);
    console.log(`Sheet ${page + 1}`);
  }
  console.log({ count: rows.length, missing });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
