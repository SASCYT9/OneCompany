/** Read-only supplier audit. Writes evidence locally; never connects to a database. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('tmp/urban-source-media');
async function fetchJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}

async function main() {
  await mkdir(output, { recursive: true });
  const manifest = JSON.parse(await readFile('public/catalog-fallback/manifest.json', 'utf8'));
  console.log('Snapshot manifest keys:', Object.keys(manifest));
  const shard = manifest.stores?.urban?.file;
  if (!shard || !/^urban\.[a-z0-9]+\.json$/i.test(shard)) throw new Error('Local Urban snapshot missing');
  const products = JSON.parse(await readFile(path.join('public/catalog-fallback', shard), 'utf8'));
  const gp: any[] = await readFile(path.join(output, 'gp.json'), 'utf8').then(JSON.parse).catch(() => []);
  const failures: string[] = [];
  let index = 0;
  let rateLimited = false;
  await Promise.all(Array.from({ length: 1 }, async () => {
    while (index < products.length) {
      const product = products[index++];
      if (gp.some(item => item.handle === product.slug)) continue;
      if (rateLimited) break;
      await new Promise(resolve => setTimeout(resolve, 800));
      try {
        gp.push(await fetchJson(`https://gp-portal.eu/products/${product.slug}.js`));
      } catch (error) {
        failures.push(String(error));
        if (String(error).includes('429:')) rateLimited = true;
      }
    }
  }));
  await writeFile(path.join(output, 'gp.json'), JSON.stringify(gp, null, 2));
  const house: unknown[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await fetchJson(`https://houseofurban.co.uk/products.json?limit=250&page=${page}`);
    house.push(...result.products);
    if (result.products.length < 250) break;
  }
  await writeFile(path.join(output, 'house.json'), JSON.stringify(house, null, 2));
  await writeFile(path.join(output, 'failures.json'), JSON.stringify(failures, null, 2));
  console.log(JSON.stringify({ local: products.length, gp: gp.length, house: house.length, failureCount: failures.length, rateLimited }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
