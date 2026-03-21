/**
 * Migrate all Urban (smgassets) images to public/images/shop/urban/
 * 1. Collect unique URLs from TS data files and collection.*.json
 * 2. Download each to public/images/shop/urban/<path after dist/img/>
 * Run: node scripts/migrate-urban-images-to-local.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { get as httpsGet } from 'node:https';

const BASE = 'https://smgassets.blob.core.windows.net/customers/urban/dist/img';
const PUBLIC_URBAN = path.join(process.cwd(), 'public', 'images', 'shop', 'urban');

function extractUrlsFromString(text) {
  const re = /https:\/\/smgassets\.blob\.core\.windows\.net\/customers\/urban\/dist\/img\/[^\s"']+/g;
  return [...new Set(text.match(re) || [])];
}

function collectFromTsAndJson() {
  const urls = new Set();
  const root = process.cwd();
  const dataDir = path.join(root, 'src', 'app', '[locale]', 'shop', 'data');
  const files = [
    path.join(dataDir, 'ourStores.ts'),
    path.join(dataDir, 'urbanHomeData.ts'),
    path.join(dataDir, 'urbanShowcasesData.ts'),
    path.join(dataDir, 'urbanCollectionsList.ts'),
  ];
  for (const f of files) {
    if (fs.existsSync(f)) {
      const text = fs.readFileSync(f, 'utf8');
      extractUrlsFromString(text).forEach((u) => urls.add(u));
    }
  }
  const templatesDir = path.join(root, 'reference', 'urban-shopify-theme', 'templates');
  if (fs.existsSync(templatesDir)) {
    for (const name of fs.readdirSync(templatesDir)) {
      if (name.startsWith('collection.') && name.endsWith('.json')) {
        const text = fs.readFileSync(path.join(templatesDir, name), 'utf8');
        extractUrlsFromString(text).forEach((u) => urls.add(u));
      }
    }
  }
  return [...urls];
}

function urlToLocalPath(url) {
  if (!url.startsWith(BASE + '/')) return null;
  const rest = url.slice(BASE.length + 1).split('?')[0];
  return path.join(PUBLIC_URBAN, rest);
}

function urlToWebPath(url) {
  if (!url.startsWith(BASE + '/')) return null;
  const rest = url.slice(BASE.length + 1).split('?')[0];
  return '/images/shop/urban/' + rest.replace(/\\/g, '/');
}

function download(url) {
  const localPath = urlToLocalPath(url);
  if (!localPath) return Promise.reject(new Error('Invalid URL: ' + url));
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = createWriteStream(localPath);
    httpsGet(url, { headers: { 'User-Agent': 'OneCompany-Migration/1' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(localPath); } catch (_) {}
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(localPath); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode} ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(localPath); });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(localPath); } catch (_) {}
      reject(err);
    });
  });
}

async function main() {
  const urls = collectFromTsAndJson();
  console.log(`Found ${urls.length} unique smgassets image URLs.`);
  fs.mkdirSync(PUBLIC_URBAN, { recursive: true });
  let ok = 0;
  let fail = 0;
  for (const url of urls) {
    try {
      await download(url);
      ok++;
      console.log(`[${ok}/${urls.length}] ${path.relative(process.cwd(), urlToLocalPath(url))}`);
    } catch (e) {
      fail++;
      console.error(`FAIL ${url}: ${e.message}`);
    }
  }
  console.log(`\nDone. Downloaded ${ok}, failed ${fail}.`);
  console.log('Next: update TS data files to use /images/shop/urban/... and add resolver in urbanThemeAssets.ts');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
