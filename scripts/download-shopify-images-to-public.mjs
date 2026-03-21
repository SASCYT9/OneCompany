/**
 * Download external (e.g. Shopify CDN) images to public/images/shop and output
 * the mapping of old URL -> new path for updating data files.
 * Run: node scripts/download-shopify-images-to-public.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';

const PUBLIC_SHOP = path.join(process.cwd(), 'public', 'images', 'shop');
const STORES_DIR = path.join(PUBLIC_SHOP, 'stores');

const TO_DOWNLOAD = [
  {
    url: 'https://cdn.shopify.com/s/files/1/0552/0615/0282/files/reveulto-valvetronic-exhaust-no-cel-3.webp?v=1752216936',
    localName: 'fi-reveulto-valvetronic-exhaust.webp',
    subdir: 'stores',
  },
];

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? httpsGet : httpGet;
    const file = createWriteStream(destPath);
    protocol(url, { headers: { 'User-Agent': 'OneCompany-Migration/1' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch (_) {}
      reject(err);
    });
  });
}

async function main() {
  fs.mkdirSync(STORES_DIR, { recursive: true });
  const results = [];
  for (const item of TO_DOWNLOAD) {
    const dir = path.join(PUBLIC_SHOP, item.subdir);
    fs.mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, item.localName);
    // eslint-disable-next-line no-console
    console.log(`Downloading ${item.url} -> ${path.relative(process.cwd(), destPath)}`);
    await download(item.url, destPath);
    const webPath = `/images/shop/${item.subdir}/${item.localName}`;
    results.push({ oldUrl: item.url, newPath: webPath });
  }
  // eslint-disable-next-line no-console
  console.log('\nDone. Use these paths in data:\n' + results.map((r) => `  "${r.oldUrl}" -> "${r.newPath}"`).join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
