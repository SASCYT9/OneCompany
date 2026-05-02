/**
 * DO88 EUR-native price scraper — crawls do88performance.eu (English/EUR
 * frontend) and pulls SKU + EUR price from every category-listing page.
 *
 * Why a spider instead of a sitemap:
 *   The /sitemap.xml only ships Swedish slugs (`/sv/artiklar/silikonslang-…/`).
 *   Those 301 to do88.se without cookies, dropping our VALUTA=EUR pref.
 *   The English EU pages live at `/en/artiklar/silicone-hose-…/` with no
 *   sitemap of their own — so we BFS-crawl from the homepage and follow only
 *   internal `/en/artiklar/…/index.html` links.
 *
 *   Cookies: VALUTA=EUR + SPRAK=EN switch responses to English + EUR.
 *   Each product card lives in `<div class="PT_Wrapper">` and exposes
 *     - <div class="PT_Pris ...">XX.XX EUR</div> (or PT_PrisKampanj for sale)
 *     - data-cart='{"altnr":"<SKU>", ...}' on the buy button
 *     - <a title="<English title>"> on the description link
 *
 * Output: scripts/do88/scraped/do88-eu-prices.json — array of
 *   { sku, titleEn, priceEur, sourceUrl }
 *
 * Usage: node scripts/do88/scrape-eu-prices.mjs
 *   No DB writes. Pure raw price feed for diffing.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.do88performance.eu';
const COOKIE = 'VALUTA=EUR; SPRAK=EN';
const OUTPUT_JSON = path.join(process.cwd(), 'scripts/do88/scraped/do88-eu-prices.json');
const DELAY_MS = 200;
const MAX_PAGES = 4000;
// Persist progress every N successfully-fetched pages so a crash mid-run
// still leaves a partial JSON to diff against — no work lost.
const SAVE_EVERY = 25;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function fetchPage(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'OneCompany-DO88-EU/1.0', Cookie: COOKIE } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
          // Off-domain redirect (e.g. .eu /sv/ → .se /sv/) drops EUR cookie:
          // skip those, surface as 404 so the spider just doesn't enqueue.
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${BASE_URL}${res.headers.location}`;
          if (!next.startsWith(BASE_URL)) {
            return reject(new Error(`Off-domain redirect to ${next}`));
          }
          return fetchPage(next, redirectsLeft - 1).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractFromDetailPage(html, pageUrl) {
  // Detail pages (e.g. /en/artiklar/bigpack-porsche-911-turbo-992.html) carry
  // the canonical price in <span class="PrisBOLD">5858.27<span class="PrisBOLDv">
  // EUR</span></span>, with the SKU surfaced via the order form
  // <input name="altnr" value="<SKU>"> and JSON-LD schema.org Product offer.
  // Per shop-owner: this is the source of truth — overrides listing-card
  // prices that sometimes show "From X.XX EUR" for variant products.
  const skuMatch = html.match(/<input[^>]+name="altnr"[^>]+value="([^"]+)"/);
  if (!skuMatch) return null;
  const sku = skuMatch[1];

  // Price priority on detail pages:
  //   1. PrisORD — regular ("ordinarie" sv) price, present when the item is
  //      currently on sale; the struck-through original we want to mirror.
  //   2. PrisBOLD — the canonical price when no sale is active.
  //   3. PrisREA — the live sale price. We deliberately ignore this so our DB
  //      doesn't drift down to a temporary discount and then strand at that
  //      level when do88 ends the campaign.
  const priceMatch =
    html.match(/<span class="PrisORD[^"]*">([0-9\s.,]+)/) ||
    html.match(/<span class="PrisBOLD[^"]*">([0-9\s.,]+)/);
  if (!priceMatch) return null;
  const priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
  const priceEur = parseFloat(priceStr);
  if (!Number.isFinite(priceEur) || priceEur <= 0) return null;

  // JSON-LD Product schema name. The regex used to grab the first "name": "..."
  // pair, which on do88 is the embedded brand object — `"brand": { "name":
  // "do88" }`. Anchor on `"@type": "Product"` to lock onto the product node.
  let titleEn = '';
  const ldMatch = html.match(/"@type"\s*:\s*"Product"\s*,\s*"name"\s*:\s*"([^"]+)"/);
  if (ldMatch) titleEn = ldMatch[1].replace(/&#8221;/g, '"').replace(/&#160;/g, ' ');
  if (!titleEn) {
    const t = html.match(/<title>([^|<]+)/);
    if (t) titleEn = t[1].trim();
  }

  return { sku, titleEn, priceEur, sourceUrl: pageUrl, source: 'detail' };
}

function extractFromListing(html, pageUrl) {
  // Listing/category pages — fallback when the detail-page extractor returned
  // nothing. Each card lives in <div class="PT_Wrapper"> and exposes its own
  // price + altnr. These are still useful for cheap items that don't have a
  // dedicated detail page.
  const products = [];
  const wrapperRe = /<div class="PT_Wrapper[\s\S]*?(?=<div class="PT_Wrapper |<\/div>\s*<div class="PT_Wrapper_All|<div class="row paging|<div id="result_artiklar)/g;
  const blocks = html.match(wrapperRe) || [];

  for (const block of blocks) {
    const skuMatch = block.match(/"altnr"\s*:\s*"([^"]+)"/);
    if (!skuMatch) continue;
    const sku = skuMatch[1];

    // Skip listing cards flagged as sale (PT_PrisKampanj / PrisREA classes).
    // We mirror do88 regular pricing only — picking up a temporary REA price
    // here would silently undercut us when the campaign ends.
    const isSaleCard = /class="[^"]*\b(?:PT_PrisKampanj|PrisREA)\b/.test(block);
    if (isSaleCard) continue;
    const priceMatch = block.match(/<div class="PT_Pris[^"]*">([0-9\s.,]+)\s*EUR/);
    if (!priceMatch) continue;
    // Skip "From X.XX EUR" (multi-variant) cards — the detail-page visit will
    // capture the canonical price.
    if (/from\s+[0-9.,]+\s*EUR/i.test(priceMatch[0])) continue;
    const priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
    const priceEur = parseFloat(priceStr);
    if (!Number.isFinite(priceEur) || priceEur <= 0) continue;

    const titleMatch =
      block.match(/<a [^>]*title="([^"]+)"/) ||
      block.match(/alt="([^"]+)"/);
    const titleEn = titleMatch ? titleMatch[1].trim() : '';

    products.push({ sku, titleEn, priceEur, sourceUrl: pageUrl, source: 'listing' });
  }

  return products;
}

function extractProducts(html, pageUrl) {
  // Detail pages live at /en/artiklar/<slug>.html (no /index.html suffix).
  // Listing pages live at /en/artiklar/<...>/index.html.
  // Prefer the detail-page <PrisBOLD> when the URL looks like a detail page;
  // otherwise treat it as a listing.
  const isDetail = /\/en\/artiklar\/[^/]+\.html$/.test(pageUrl) && !pageUrl.endsWith('/index.html');
  if (isDetail) {
    const detail = extractFromDetailPage(html, pageUrl);
    if (detail) return [detail];
    // Some detail-style URLs are actually category landings — fall through.
  }
  return extractFromListing(html, pageUrl);
}

function extractEnLinks(html) {
  // Pull every anchor whose href targets /en/artiklar/.../index.html (or any
  // /en/artiklar/ URL) so we discover both category index pages and detail
  // pages. Returns absolute URLs.
  const out = new Set();
  const linkRe = /href="([^"]*\/en\/artiklar\/[^"]*)"/g;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    let href = m[1];
    if (href.startsWith('//')) href = `https:${href}`;
    else if (href.startsWith('/')) href = `${BASE_URL}${href}`;
    if (href.startsWith(BASE_URL)) {
      // Drop fragments / query, keep canonical
      const clean = href.split('#')[0].split('?')[0];
      out.add(clean);
    }
  }
  return [...out];
}

function mergePreferDetail(all) {
  // Detail-page prices override listing-card prices for the same SKU. For
  // duplicates within the same source, prefer the entry with a real title.
  const bySku = new Map();
  for (const p of all) {
    const prev = bySku.get(p.sku);
    if (!prev) { bySku.set(p.sku, p); continue; }
    const prevIsDetail = prev.source === 'detail';
    const curIsDetail = p.source === 'detail';
    if (curIsDetail && !prevIsDetail) { bySku.set(p.sku, p); continue; }
    if (!curIsDetail && prevIsDetail) continue;
    if (!prev.titleEn && p.titleEn) bySku.set(p.sku, p);
  }
  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

function savePartial(all) {
  const unique = mergePreferDetail(all);
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(unique, null, 2), 'utf-8');
}

async function main() {
  console.log('🇪🇺 DO88 EU-native price scraper (spider)');
  console.log('==========================================');
  console.log(`   Source: ${BASE_URL} (cookie: ${COOKIE})`);

  const visited = new Set();
  const queue = [`${BASE_URL}/en/`];
  // Seed with main category roots — these aggregate links to every leaf.
  queue.push(`${BASE_URL}/en/artiklar/silicone-hose-_-hoses/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-accessories/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/aluminium-pipes/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/engine-_-tuning/index.html`);
  // Real vehicle-specific roots — discovered from /en/ home page anchors.
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/audi/rs6-rs7-40-v8-tfsi-c8/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/audi/rs3/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/audi/rs6/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/bmw/g80-g87-s58-m2-m3-m4/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/9921/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/9922-carrera-911/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/992-turbo/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/9912/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/9912-carrera-t-911/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/991/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/9971/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/porsche/9972/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/toyota-2/gr-supra-a90/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/toyota-2/gr-yaris/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/hose-kits/vw/golf-mk-7-mk-75-mqb-13-19/index.html`);
  queue.push(`${BASE_URL}/en/artiklar/golf-mk-7-mk-75-mqb-13-19/index.html`);

  // Resume support: load any existing scrape so a re-run only needs to fill
  // gaps. Each restart of the Bash-spawned process so far has been cut off
  // around page 40-450 (no explicit error), so accumulating across runs is
  // the practical path to full coverage.
  const all = [];
  if (fs.existsSync(OUTPUT_JSON)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'));
      if (Array.isArray(existing)) {
        all.push(...existing);
        console.log(`   Resuming with ${existing.length} previously scraped SKUs.`);
      }
    } catch { /* corrupt — start clean */ }
  }
  let pages = 0;
  let okCount = 0;

  while (queue.length && pages < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    pages++;

    const short = url.replace(BASE_URL, '').slice(0, 75);
    process.stdout.write(`  [${pages.toString().padStart(3)} q=${queue.length.toString().padStart(3)}] ${short.padEnd(75)} `);

    try {
      const html = await fetchPage(url);
      const products = extractProducts(html, url);
      all.push(...products);
      const links = extractEnLinks(html);
      let added = 0;
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
          added++;
        }
      }
      okCount++;
      console.log(`✅ ${products.length.toString().padStart(3)} prods | +${added.toString().padStart(3)} links`);
      if (okCount % SAVE_EVERY === 0) {
        // Snapshot — keeps the most recent crawl on disk so we can inspect
        // partial progress and survive crashes without re-running.
        savePartial(all);
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  const unique = mergePreferDetail(all);

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(unique, null, 2), 'utf-8');

  console.log(`\n📊 Crawl complete:`);
  console.log(`   Pages visited: ${pages}`);
  console.log(`   Pages 200 OK:  ${okCount}`);
  console.log(`   Raw extractions: ${all.length}`);
  console.log(`   Unique SKUs: ${unique.length}`);
  console.log(`💾 Saved: ${OUTPUT_JSON}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
