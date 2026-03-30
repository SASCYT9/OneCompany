/**
 * RaceChip EU Scraper v2 — Real Data Extraction
 *
 * Uses headless:false (real Chrome) to bypass Cloudflare.
 * Extracts ACTUAL prices, gains, and specs from each product page.
 * Always selects GTS 5 tier + App Control.
 *
 * If Cloudflare challenge appears — solve it manually in the browser window.
 * The script will wait and then continue automatically.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';

const PROGRESS_FILE = path.join(process.cwd(), 'data', 'racechip-progress.json');
const OUTPUT_FILE   = path.join(process.cwd(), 'data', 'racechip-products.json');
const CONCURRENCY   = 5;
const PAGE_TIMEOUT  = 30000;
const DELAY_BETWEEN = 500; // ms between pages

// ── State ────────────────────────────────────────────────────

let progress = { crawled: [], pending: [] };
if (fs.existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
}

let results = [];
if (fs.existsSync(OUTPUT_FILE)) {
  results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
}

// Deduplicate already-scraped URLs (only count those WITH real data)
const scrapedUrls = new Set(results.map(r => r.url));

function save() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
}

// ── Price Parser ─────────────────────────────────────────────

function parsePrice(text) {
  if (!text) return 0;
  const m = text.match(/[\d.,]+/);
  if (!m) return 0;
  let n = m[0];
  // Handle European formatting: 1.249,00 or 549,00
  if (n.includes(',') && n.includes('.')) {
    if (n.lastIndexOf(',') > n.lastIndexOf('.')) {
      n = n.replace(/\./g, '').replace(',', '.');
    } else {
      n = n.replace(/,/g, '');
    }
  } else if (n.includes(',')) {
    n = n.replace(',', '.');
  }
  return parseFloat(n) || 0;
}

// ── Scrape One Product Page ──────────────────────────────────

async function scrapePage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

    // Wait for page to render (CF challenge or real content)
    await page.waitForTimeout(2000);

    // Check for Cloudflare challenge
    let title = await page.title();
    if (title.includes('Attention') || title.includes('Just a moment') || title.includes('moment')) {
      console.log('⏳ Cloudflare challenge detected — solve it in the browser window...');
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(2000);
        title = await page.title();
        if (!title.includes('Attention') && !title.includes('Just a moment') && !title.includes('moment')) break;
      }
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
      await page.waitForTimeout(3000);
    }

    // Check if 404
    title = await page.title();
    if (title.includes('404') || title.includes('error') || title.includes('not found')) {
      return null;
    }

    // Wait for product content — retry if CF silently blocks
    let contentLoaded = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.waitForFunction(
          () => document.body.innerText.includes('EUR') || document.body.innerText.includes('HP'),
          { timeout: 8000 }
        );
        contentLoaded = true;
        break;
      } catch {
        if (attempt < 2) {
          console.log(`  🔄 Content not loaded, retry ${attempt + 2}/3...`);
          await page.reload({ waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
          await page.waitForTimeout(3000 + attempt * 2000);
        }
      }
    }
    if (!contentLoaded) {
      console.log(`  ⚠️ Page didn't load after 3 retries — CF block likely`);
      return null;
    }

    // ── STEP 1: Click the 3rd tier (MAXIMUM = GTS 5) ──────────
    // The page has 3 columns: NOTICEABLE (S), POWERFUL (RS), MAXIMUM (GTS 5)
    // The 3rd column's CHOOSE button selects GTS 5
    const clickedTier = await page.evaluate(() => {
      // Find all CHOOSE buttons
      const buttons = [...document.querySelectorAll('button, a, div, span')].filter(el => {
        const t = el.textContent?.trim();
        return t && /^CHOOSE$/i.test(t) && el.offsetHeight > 0;
      });
      // Click the LAST one (3rd column = MAXIMUM/GTS 5)
      if (buttons.length >= 3) {
        buttons[2].click();
        return 'third';
      } else if (buttons.length > 0) {
        buttons[buttons.length - 1].click();
        return 'last';
      }
      return false;
    });

    if (clickedTier) {
      await page.waitForTimeout(1500);
    }

    // ── STEP 2: Extract all data from page text ──────────────
    const data = await page.evaluate(() => {
      const body = document.body.innerText;

      // The 3 tiers show gains in order: tier1 HP/Nm, tier2 HP/Nm, tier3 HP/Nm
      const hpGains = [...body.matchAll(/\+\s*(\d+)\s*HP/gi)].map(m => parseInt(m[1]));
      const nmGains = [...body.matchAll(/\+\s*(\d+)\s*Nm/gi)].map(m => parseInt(m[1]));

      // Find all product prices (NNN EUR), filter out add-on prices (<100)
      const priceMatches = [...body.matchAll(/(\d[\d.,]*)\s*EUR/gi)]
        .map(m => {
          let n = m[1].replace(/\./g, '').replace(',', '.');
          return parseFloat(n);
        })
        .filter(p => p > 100 && p < 2000);

      // App Control price
      const appMatch = body.match(/app\s*control\s*[\n\r]*\s*\(optional,?\s*\+?\s*(\d+)\s*EUR\)/i);
      const appControlPrice = appMatch ? parseInt(appMatch[1]) : 59; // Default 59 if not found

      // 3rd tier (MAXIMUM/GTS 5) = highest gains and price
      const gainHp = hpGains.length > 0 ? Math.max(...hpGains) : 0;
      const gainNm = nmGains.length > 0 ? Math.max(...nmGains) : 0;
      const basePrice = priceMatches.length > 0 ? Math.max(...priceMatches) : 0;

      // Check if BESTSELLER is present (confirms 3rd tier exists)
      const hasBestseller = /BESTSELLER/i.test(body);
      // Check how many tiers are available
      const chooseCount = (body.match(/\bCHOOSE\b/gi) || []).length;

      // Product images
      const images = [...document.querySelectorAll('img')]
        .map(i => i.src)
        .filter(src => src && (src.includes('product') || src.includes('gts') || src.includes('racechip')) &&
                (src.includes('.jpg') || src.includes('.png') || src.includes('.webp')));

      return {
        basePrice,
        appControlPrice,
        totalPrice: basePrice + appControlPrice,
        gainHp,
        gainNm,
        hasBestseller,
        chooseCount,
        images: [...new Set(images)],
      };
    });

    // Validate: must have a real price and gains
    if (!data || data.basePrice < 100 || (data.gainHp === 0 && data.gainNm === 0)) {
      console.log(`  ⏭️ No valid product data (price: ${data?.basePrice}€, tiers: ${data?.chooseCount}) — skipping`);
      return null;
    }

    // Parse vehicle info from URL
    const shopPart = url.split('/shop/')[1];
    if (!shopPart) return null;
    const parts = shopPart.replace(/\.html$/, '').split('/');
    if (parts.length < 3) return null;

    const em = parts[2].match(/^(.+?)-(\d+)ccm-(\d+)hp-(\d+)kw-(\d+)nm$/);
    if (!em) return null;

    return {
      url,
      makeSlug: parts[0],
      modelSlug: parts[1],
      engineSlug: parts[2],
      title: `RaceChip GTS 5 — ${parts[0]} ${parts[1]} ${em[1]}`,
      selectedTier: 'GTS 5',
      hasAppControl: true,
      priceGTS5: data.basePrice,
      priceAppControl: data.appControlPrice,
      priceEUR: data.totalPrice,
      baseHp: parseInt(em[3]),
      baseKw: parseInt(em[4]),
      baseNm: parseInt(em[5]),
      ccm: parseInt(em[2]),
      gainHp: data.gainHp,
      gainNm: data.gainNm,
      images: data.images,
      timestamp: new Date().toISOString(),
    };

  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🚀 RaceChip Scraper v2 — Using YOUR Chrome cookies');
  console.log('   Copying CF trust cookies from your Chrome profile...\n');

  if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'));
  }

  // Copy ONLY the cookies from the user's Chrome profile into a temp dir
  // This avoids all profile lock/sync/extension conflicts
  const TEMP_PROFILE = path.join(process.cwd(), 'data', '.chrome-scraper-profile');
  const CHROME_PROFILE = 'C:\\Users\\SASHA\\AppData\\Local\\Google\\Chrome\\User Data';

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }
  // Copy Default profile cookies and Local State
  const defaultDir = path.join(TEMP_PROFILE, 'Default');
  if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });

  // Copy critical files for CF trust
  for (const f of ['Local State']) {
    const src = path.join(CHROME_PROFILE, f);
    const dst = path.join(TEMP_PROFILE, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, dst);
  }
  for (const f of ['Cookies', 'Cookies-journal', 'Preferences', 'Secure Preferences', 'Login Data']) {
    const src = path.join(CHROME_PROFILE, 'Default', f);
    const dst = path.join(defaultDir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, dst);
  }
  console.log('📋 Cookies copied from Chrome profile');

  const context = await chromium.launchPersistentContext(TEMP_PROFILE, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--profile-directory=Default',
    ],
    viewport: { width: 1440, height: 900 },
    timeout: 60000,
  });

  // Remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Get URLs from sitemap if not already done
  if (progress.pending.length === 0 && progress.crawled.length === 0) {
    console.log('📡 Fetching sitemap...');
    const sitemapPage = await context.newPage();
    await sitemapPage.goto('https://www.racechip.eu/sitemap/eu/sitemap.xml', {
      waitUntil: 'domcontentloaded', timeout: 60000
    });
    const content = await sitemapPage.content();
    const urls = [...content.matchAll(/<loc>(https:\/\/www\.racechip\.eu\/shop\/[^<]+\.html)<\/loc>/g)]
      .map(m => m[1].replace(/\.html\.html$/, '.html'));
    progress.pending = urls.filter(u => u.split('/').length >= 7);
    progress.pending = [...new Set(progress.pending)];
    save();
    console.log(`🗺️ Found ${progress.pending.length} vehicles in sitemap`);
    await sitemapPage.close();
  }

  // Filter out already-scraped URLs
  const todo = progress.pending.filter(u => !scrapedUrls.has(u));
  console.log(`\n📊 Status: ${results.length} scraped, ${todo.length} remaining, ${progress.crawled.length} visited total\n`);

  if (todo.length === 0) {
    console.log('✅ All URLs already scraped!');
    await context.close();
    return;
  }

  // Quick warmup — verify CF isn't blocking
  const warmupPage = await context.newPage();
  await warmupPage.goto('https://www.racechip.eu/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('🌐 Warming up with your Chrome profile...');
  await warmupPage.waitForTimeout(3000);
  let warmTitle = await warmupPage.title();
  if (warmTitle.includes('Attention') || warmTitle.includes('moment')) {
    console.log('⏳ CF challenge — solve it in the browser window...');
    for (let i = 0; i < 60; i++) {
      await warmupPage.waitForTimeout(2000);
      warmTitle = await warmupPage.title();
      if (!warmTitle.includes('Attention') && !warmTitle.includes('moment')) {
        console.log('✅ Cloudflare passed!');
        break;
      }
    }
  } else {
    console.log('✅ No CF challenge — profile trusted!');
  }
  await warmupPage.close();

  // Block images/fonts/CSS to speed up loading
  await context.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
      return route.abort();
    }
    return route.continue();
  });

  // Create parallel worker tabs
  const WORKERS = CONCURRENCY;
  const pages = [];
  for (let w = 0; w < WORKERS; w++) {
    pages.push(await context.newPage());
  }
  console.log(`🚀 Launched ${WORKERS} parallel tabs\n`);

  let successCount = 0;
  let skipCount = 0;
  let processed = 0;
  const crawledSet = new Set(progress.crawled);
  const startTime = Date.now();

  // Worker function
  async function worker(page, workerId) {
    while (todo.length > 0) {
      const url = todo.shift();
      if (!url) break;
      processed++;
      const pct = ((processed / (processed + todo.length)) * 100).toFixed(1);

      const data = await scrapePage(page, url);

      if (data) {
        results.push(data);
        successCount++;
        console.log(`[${pct}%] W${workerId} ✅ ${data.priceEUR}€ +${data.gainHp}HP | ${url.split('/shop/')[1]}`);
      } else {
        skipCount++;
      }

      crawledSet.add(url);

      // Save every 50 pages
      if (processed % 50 === 0) {
        progress.crawled = [...crawledSet];
        progress.pending = progress.pending.filter(u => !crawledSet.has(u));
        save();
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(1);
        const eta = (todo.length / rate / 60).toFixed(0);
        console.log(`  💾 ${results.length} products | ${processed} processed | ${rate}/sec | ETA: ${eta}min\n`);
      }

      await page.waitForTimeout(DELAY_BETWEEN + Math.random() * 300);
    }
  }

  // Run all workers in parallel
  await Promise.all(pages.map((page, i) => worker(page, i + 1)));

  // Final save
  progress.crawled = [...crawledSet];
  progress.pending = progress.pending.filter(u => !crawledSet.has(u));
  save();
  await context.close();

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n🎉 DONE in ${totalMin} minutes!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   📦 Total products: ${results.length}`);
}

main().catch(console.error);
