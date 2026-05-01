/**
 * RaceChip Audit: Source vs Local
 *
 * Compares racechip.eu's product sitemap against our scraped JSON to find:
 *   - Missing makes
 *   - Missing model generations (e.g. RS6 C8)
 *   - Missing engine variants under existing models
 *
 * Output:
 *   1. data/racechip-missing-models.json — human report
 *   2. data/racechip-progress.json (updated) — appends missing URLs to .pending
 *      so scripts/scrape-racechip.mjs picks them up next run.
 *
 * Note: sitemap is usually NOT CF-gated; if direct fetch is blocked, fall back
 *       to launching the existing scrape-racechip.mjs (it has CF handling).
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const SITEMAP_URL = 'https://www.racechip.eu/sitemap/eu/sitemap.xml';
const PRODUCTS_FILE = path.join(process.cwd(), 'data', 'racechip-products.json');
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'racechip-progress.json');
const REPORT_FILE = path.join(process.cwd(), 'data', 'racechip-missing-models.json');
const TEMP_PROFILE = path.join(process.cwd(), 'data', '.chrome-scraper-profile');
const CHROME_PROFILE = 'C:\\Users\\SASHA\\AppData\\Local\\Google\\Chrome\\User Data';

function parseProductUrl(url) {
  // https://www.racechip.eu/shop/{make}/{model}/{engine}.html
  const m = url.match(/\/shop\/([^/]+)\/([^/]+)\/([^/]+)\.html$/);
  if (!m) return null;
  return { makeSlug: m[1], modelSlug: m[2], engineSlug: m[3], url };
}

function extractUrlsFromXml(xml) {
  const urls = [...xml.matchAll(/<loc>(https:\/\/www\.racechip\.eu\/shop\/[^<]+\.html)<\/loc>/g)]
    .map((m) => m[1].replace(/\.html\.html$/, '.html'));
  return [...new Set(urls)];
}

async function fetchSitemapDirect() {
  const res = await fetch(SITEMAP_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Accept: 'application/xml,text/xml,*/*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchSitemapViaBrowser() {
  // Mirror scrape-racechip.mjs's CF-handling approach: real Chrome with the
  // user's profile cookies copied into a sandbox dir.
  if (!fs.existsSync(TEMP_PROFILE)) fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  const defaultDir = path.join(TEMP_PROFILE, 'Default');
  if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });
  for (const f of ['Local State']) {
    const src = path.join(CHROME_PROFILE, f);
    const dst = path.join(TEMP_PROFILE, f);
    if (fs.existsSync(src)) try { fs.copyFileSync(src, dst); } catch { /* lock */ }
  }
  for (const f of ['Cookies', 'Cookies-journal', 'Preferences', 'Secure Preferences', 'Login Data']) {
    const src = path.join(CHROME_PROFILE, 'Default', f);
    const dst = path.join(defaultDir, f);
    if (fs.existsSync(src)) try { fs.copyFileSync(src, dst); } catch { /* lock */ }
  }

  console.log('🌐 Launching Chrome (close any open Chrome windows if you see lock errors)...');
  const ctx = await chromium.launchPersistentContext(TEMP_PROFILE, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--profile-directory=Default'],
    viewport: { width: 1280, height: 800 },
    timeout: 60000,
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    const page = await ctx.newPage();
    // Warm up
    await page.goto('https://www.racechip.eu/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    let title = await page.title();
    if (title.includes('moment') || title.includes('Attention')) {
      console.log('⏳ Cloudflare challenge — solve it in the browser window (waiting up to 2 min)...');
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(2000);
        title = await page.title();
        if (!title.includes('moment') && !title.includes('Attention')) {
          console.log('✅ CF passed.');
          break;
        }
      }
    }

    await page.goto(SITEMAP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    title = await page.title();
    if (title.includes('moment') || title.includes('Attention')) {
      console.log('⏳ CF challenge on sitemap — solve it (waiting up to 2 min)...');
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(2000);
        title = await page.title();
        if (!title.includes('moment') && !title.includes('Attention')) break;
      }
    }
    const xml = await page.content();
    return xml;
  } finally {
    await ctx.close();
  }
}

async function fetchSitemap() {
  console.log(`📡 Fetching sitemap: ${SITEMAP_URL}`);
  try {
    const xml = await fetchSitemapDirect();
    console.log('   direct fetch ok');
    return extractUrlsFromXml(xml);
  } catch (err) {
    console.log(`   direct fetch failed (${err.message}) — falling back to browser`);
    const xml = await fetchSitemapViaBrowser();
    return extractUrlsFromXml(xml);
  }
}

async function main() {
  // 1. Load local data
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error(`❌ Missing: ${PRODUCTS_FILE}`);
    process.exit(1);
  }
  const localProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  console.log(`📦 Local products: ${localProducts.length}`);

  const localUrls = new Set(localProducts.map((p) => p.url));
  const localMakes = new Set(localProducts.map((p) => p.makeSlug));
  const localModels = new Set(localProducts.map((p) => `${p.makeSlug}::${p.modelSlug}`));

  let progress = { crawled: [], pending: [] };
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  const crawledSet = new Set(progress.crawled || []);
  const pendingSet = new Set(progress.pending || []);

  // 2. Fetch sitemap
  const sourceUrls = await fetchSitemap();
  console.log(`🌐 Sitemap: ${sourceUrls.length} product URLs`);

  // 3. Diff: URLs in sitemap that aren't in our products.json (success store).
  // We INCLUDE URLs that are in `crawled` but missing from products — those are
  // previously-failed scrapes (CF-blocked, parse errors, etc.) that should be retried.
  const missingUrls = [];
  const missingByModel = new Map(); // make::model → [urls]
  const newMakes = new Set();
  const newModels = new Set();
  let previouslyFailedCount = 0;

  for (const url of sourceUrls) {
    const parsed = parseProductUrl(url);
    if (!parsed) continue;
    if (localUrls.has(url)) continue; // already successfully scraped

    if (crawledSet.has(url)) previouslyFailedCount++;

    missingUrls.push(parsed);
    const modelKey = `${parsed.makeSlug}::${parsed.modelSlug}`;
    if (!localMakes.has(parsed.makeSlug)) newMakes.add(parsed.makeSlug);
    if (!localModels.has(modelKey)) newModels.add(modelKey);

    if (!missingByModel.has(modelKey)) missingByModel.set(modelKey, []);
    missingByModel.get(modelKey).push(url);
  }

  console.log(`\n── DIFF ──`);
  console.log(`  ➕ ${missingUrls.length} engine URLs not in local DB`);
  console.log(`     (${previouslyFailedCount} previously attempted but failed, will retry)`);
  console.log(`  ➕ ${newModels.size} new model generations`);
  console.log(`  ➕ ${newMakes.size} new makes`);

  // 4. Highlight RS6-related (the user's specific concern)
  const audiRs6 = missingUrls.filter((p) => p.makeSlug === 'audi' && /^rs6/.test(p.modelSlug));
  if (audiRs6.length) {
    console.log(`\n⭐ Audi RS6 missing engines: ${audiRs6.length}`);
    const generations = new Set(audiRs6.map((p) => p.modelSlug));
    for (const g of generations) console.log(`     - ${g}`);
  }

  // 5. Write report
  const report = {
    generatedAt: new Date().toISOString(),
    sitemapUrl: SITEMAP_URL,
    totals: {
      sourceUrls: sourceUrls.length,
      localProducts: localProducts.length,
      missingUrls: missingUrls.length,
      newModels: newModels.size,
      newMakes: newMakes.size,
    },
    newMakes: [...newMakes].sort(),
    newModelsByMake: [...missingByModel.entries()]
      .filter(([key]) => !localModels.has(key))
      .map(([key, urls]) => {
        const [make, model] = key.split('::');
        return { make, model, engineCount: urls.length, urls };
      })
      .sort((a, b) =>
        a.make === b.make ? a.model.localeCompare(b.model) : a.make.localeCompare(b.make)
      ),
    missingEngineUrlsForExistingModels: [...missingByModel.entries()]
      .filter(([key]) => localModels.has(key))
      .map(([key, urls]) => {
        const [make, model] = key.split('::');
        return { make, model, engineCount: urls.length, urls };
      })
      .sort((a, b) =>
        a.make === b.make ? a.model.localeCompare(b.model) : a.make.localeCompare(b.make)
      ),
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📝 Report: ${REPORT_FILE}`);

  // 6. Append missing URLs to progress.pending so scrape-racechip.mjs picks them up.
  // We include previously-crawled URLs that failed (i.e. not in localUrls). The
  // scraper itself filters against `localUrls` (its scrapedUrls set), so retry
  // is safe — won't duplicate successful entries.
  let added = 0;
  for (const { url } of missingUrls) {
    if (!pendingSet.has(url)) {
      pendingSet.add(url);
      added++;
    }
  }
  progress.pending = [...pendingSet];
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  console.log(`📥 Added ${added} URLs to ${PROGRESS_FILE} (.pending)`);
  console.log(`\n▶️  Next: node scripts/scrape-racechip.mjs   (handles CF challenge)`);
  console.log(`         IMPORT_NEW_ONLY=1 npx tsx scripts/import-racechip.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
