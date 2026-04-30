/**
 * RaceChip price rescrape — JSON-LD based, high concurrency.
 *
 * Why: RaceChip rolled out a new top tier "GTS 5 Black" after our last scrape
 * (2026-03-30), so storefront prices/gains drifted out of date.
 *
 * How: every product page exposes a `<script type="application/ld+json">` per
 * tier with the canonical price. We fetch via Playwright (Cloudflare blocks
 * raw fetch even with cf_clearance), but skip clicks — JSON-LD is in the
 * server-rendered HTML, so each page is one navigation + regex read.
 *
 * For each url we record the *highest* tier price *with App Control* (the
 * "GTS Black Connect" SKU when present, otherwise "GTS Connect" / next best).
 *
 * Updates ONLY: priceGTS5, priceAppControl, priceEUR, gainHp, gainNm,
 * selectedTier — preserves title/images.
 *
 * Resumable via data/racechip-rescrape-progress.json.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PRODUCTS_FILE = path.join(process.cwd(), 'data', 'racechip-products.json');
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'racechip-rescrape-progress.json');
const TEMP_PROFILE  = path.join(process.cwd(), 'data', '.chrome-scraper-profile');

const CONCURRENCY  = 20;       // user PC can handle more — bump if needed
const PAGE_TIMEOUT = 25000;
const HEADLESS     = false;    // CF detects headless even with profile cookies
const SAVE_EVERY   = 100;

if (!fs.existsSync(PRODUCTS_FILE)) {
  console.error('Missing', PRODUCTS_FILE);
  process.exit(1);
}

const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
const byUrl = new Map(products.map((p) => [p.url, p]));

let progress = { completedUrls: [] };
if (fs.existsSync(PROGRESS_FILE)) {
  try { progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')); } catch {}
}
const completed = new Set(progress.completedUrls);

function atomicWrite(file, content) {
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(tmp, content);
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch {}
      if (attempt === 4) throw e;
      // exponential backoff for Windows file-lock contention (AV, indexer, etc.)
      const wait = 200 * Math.pow(2, attempt);
      const end = Date.now() + wait;
      while (Date.now() < end) { /* spin */ }
    }
  }
}

let saving = false;
async function save() {
  if (saving) return;
  saving = true;
  try {
    atomicWrite(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    atomicWrite(PROGRESS_FILE, JSON.stringify({ completedUrls: [...completed] }, null, 2));
  } finally {
    saving = false;
  }
}

// ── Tier picker ────────────────────────────────────────────────────────
// Pick the highest-tier "+ App Control" product from the JSON-LD list.
// Priority: GTS Black Connect → GTS Connect → RS Connect → S Connect.
// Falls back to the non-Connect equivalent + 59 EUR if no Connect SKU exists.
const TIER_PRIORITY = [
  { skuPart: 'GTS Black Connect', label: 'GTS 5 Black + App' },
  { skuPart: 'GTS Connect',       label: 'GTS 5 + App' },
  { skuPart: 'RS Connect',        label: 'RS Connect' },
  { skuPart: 'S Connect',         label: 'S Connect' },
];
const NON_CONNECT_FALLBACK = [
  { skuPart: 'GTS Black', label: 'GTS 5 Black' },
  { skuPart: 'GTS',       label: 'GTS 5' },
  { skuPart: 'RS',        label: 'RS' },
  { skuPart: 'S',         label: 'S' },
];

function pickTopTierWithApp(products) {
  // products: array of JSON-LD Product objects already typed @type=Product
  for (const t of TIER_PRIORITY) {
    const p = products.find((p) => typeof p.sku === 'string' && p.sku.includes(t.skuPart));
    if (p && p.offers?.price) return { ...t, product: p, isConnect: true };
  }
  // fallback: pick highest non-Connect, will add 59 manually
  for (const t of NON_CONNECT_FALLBACK) {
    const p = products.find((p) =>
      typeof p.sku === 'string' &&
      p.sku.includes(t.skuPart) &&
      !p.sku.includes('Connect') &&
      !p.sku.includes('XLR'),
    );
    if (p && p.offers?.price) return { ...t, product: p, isConnect: false };
  }
  return null;
}

function parseGainsFromDescription(desc) {
  if (!desc) return { hp: 0, nm: 0 };
  const hp = desc.match(/\+\s*(\d+)\s*HP/i);
  const nm = desc.match(/\+\s*(\d+)\s*Nm/i);
  return { hp: hp ? +hp[1] : 0, nm: nm ? +nm[1] : 0 };
}

// ── Per-page scrape ────────────────────────────────────────────────────
async function scrape(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

  // Cloudflare interstitial recovery
  let title = await page.title();
  if (title.includes('Attention') || title.includes('moment')) {
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      title = await page.title();
      if (!title.includes('Attention') && !title.includes('moment')) break;
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
  }

  const html = await page.content();
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const productsLd = [];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1]);
      if (j && j['@type'] === 'Product') productsLd.push(j);
    } catch {}
  }
  if (!productsLd.length) return null;

  const pick = pickTopTierWithApp(productsLd);
  if (!pick) return null;

  const totalPriceFromLd = parseFloat(pick.product.offers.price);
  if (!Number.isFinite(totalPriceFromLd) || totalPriceFromLd < 50) return null;

  // App Control: when JSON-LD entry IS the Connect SKU, the price IS total
  // (base + 59). When it's the non-Connect fallback, we add 59 ourselves.
  const appControlPrice = 59;
  let priceGTS5;
  let priceEUR;
  let selectedTier;
  if (pick.isConnect) {
    priceEUR = totalPriceFromLd;
    priceGTS5 = totalPriceFromLd - appControlPrice;
    selectedTier = pick.label;
  } else {
    priceGTS5 = totalPriceFromLd;
    priceEUR = totalPriceFromLd + appControlPrice;
    selectedTier = `${pick.label} + App`;
  }

  const gains = parseGainsFromDescription(pick.product.description);

  return {
    priceGTS5,
    priceAppControl: appControlPrice,
    priceEUR,
    gainHp: gains.hp,
    gainNm: gains.nm,
    selectedTier,
  };
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const todo = products.filter((p) => !completed.has(p.url));
  console.log(`📦 ${products.length} total | ${todo.length} to rescrape | ${completed.size} done`);
  if (!todo.length) {
    console.log('✓ Nothing to do');
    return;
  }

  const ctx = await chromium.launchPersistentContext(TEMP_PROFILE, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: HEADLESS,
    args: ['--disable-blink-features=AutomationControlled', '--profile-directory=Default'],
    viewport: { width: 1280, height: 800 },
    timeout: 60000,
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Strip everything we don't need
  await ctx.route('**/*', (r) => {
    const t = r.request().resourceType();
    if (['image', 'font', 'stylesheet', 'media', 'manifest'].includes(t)) return r.abort();
    return r.continue();
  });

  // Warmup CF
  const wp = await ctx.newPage();
  await wp.goto('https://www.racechip.eu/', { waitUntil: 'domcontentloaded' });
  await wp.waitForTimeout(2500);
  let wt = await wp.title();
  if (wt.includes('Attention') || wt.includes('moment')) {
    console.log('⏳ Solve CF in window...');
    for (let i = 0; i < 60; i++) {
      await wp.waitForTimeout(2000);
      wt = await wp.title();
      if (!wt.includes('Attention') && !wt.includes('moment')) break;
    }
  }
  console.log('✓ CF warmup done');
  await wp.close();

  const pages = [];
  for (let i = 0; i < CONCURRENCY; i++) pages.push(await ctx.newPage());
  console.log(`🚀 ${CONCURRENCY} parallel tabs`);

  const queue = [...todo];
  let processed = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  const start = Date.now();

  async function worker(page, id) {
    while (queue.length) {
      const product = queue.shift();
      if (!product) break;
      processed++;
      try {
        const r = await scrape(page, product.url);
        if (r) {
          const before = product.priceEUR;
          product.priceGTS5       = r.priceGTS5;
          product.priceAppControl = r.priceAppControl;
          product.priceEUR        = r.priceEUR;
          product.gainHp          = r.gainHp || product.gainHp;
          product.gainNm          = r.gainNm || product.gainNm;
          product.selectedTier    = r.selectedTier;
          product.timestamp       = new Date().toISOString();
          if (before !== r.priceEUR) {
            updated++;
            if (updated <= 30 || updated % 100 === 0) {
              console.log(`[W${id}] ${before}€ → ${r.priceEUR}€ (${r.selectedTier}, +${r.gainHp}HP) | ${product.url.split('/shop/')[1]}`);
            }
          } else unchanged++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
        if (failed <= 10) console.warn(`[W${id}] ❌ ${e.message?.slice(0, 100)}`);
      }
      completed.add(product.url);

      if (processed % SAVE_EVERY === 0) {
        await save();
        const sec = (Date.now() - start) / 1000;
        const rate = processed / sec;
        const eta = (queue.length / Math.max(rate, 0.01) / 60).toFixed(1);
        console.log(`💾 ${processed}/${todo.length} | rate ${rate.toFixed(2)}/s | ETA ${eta}min | upd=${updated} same=${unchanged} fail=${failed}`);
      }
    }
  }

  await Promise.all(pages.map((p, i) => worker(p, i + 1)));
  await save();
  await ctx.close();

  const totalMin = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`\n🎉 Done in ${totalMin}min — updated ${updated}, unchanged ${unchanged}, failed ${failed}`);
}

main().catch(async (e) => {
  console.error(e);
  try { await save(); } catch {}
  process.exit(1);
});
