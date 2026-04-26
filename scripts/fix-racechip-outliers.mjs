/**
 * fix-racechip-outliers.mjs
 *
 * Re-scrape ONLY the 5 RaceChip product pages whose stored priceEur is an outlier
 * (>=1500 EUR). The original scrape-racechip.mjs took Math.max(allPricesOnPage)
 * which on these pages caught a bundle/promo price (1699 EUR) instead of the
 * GTS 5 tier base price.
 *
 * This script:
 *  1) opens each URL in headed Chrome with cookies copied from the user's
 *     real Chrome profile (same warmup approach as scrape-racechip.mjs);
 *  2) clicks the 3rd CHOOSE button (= MAXIMUM / GTS 5 column) like the
 *     original scraper does;
 *  3) extracts prices DOM-aware: it tries to find the price node inside the
 *     same tier container as the clicked CHOOSE button. If that fails, it
 *     falls back to "drop the outlier and take Math.max of the rest".
 *  4) verifies all results are sane (< 1500 EUR) and writes them to the DB.
 *
 * The 5 outlier slugs come from the audit done in this conversation:
 *   - racechip-gts5-dodge-caliber-2006-to-2011-2-2-crd-2143ccm-163hp-120kw-410nm
 *   - racechip-gts5-dodge-nitro-2006-to-2012-2-8-crd-2777ccm-177hp-130kw-410nm
 *   - racechip-gts5-lamborghini-urus-from-2018-4-0t-3996ccm-650hp-478kw-850nm
 *   - racechip-gts5-mclaren-570s-from-2015-3-8-v8-3799ccm-570hp-419kw-600nm
 *   - racechip-gts5-mclaren-570gt-from-2016-3-8-v8-3799ccm-570hp-419kw-600nm
 *
 * App Control add-on (~50-59 EUR) is included in the final priceEur, matching
 * the convention used by the original scraper.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const PAGE_TIMEOUT = 30000;
const APPLY_DB = process.argv.includes('--apply');

const TARGETS = [
  {
    slug: 'racechip-gts5-dodge-caliber-2006-to-2011-2-2-crd-2143ccm-163hp-120kw-410nm',
    url: 'https://www.racechip.eu/shop/dodge/caliber-2006-to-2011/2-2-crd-2143ccm-163hp-120kw-410nm.html',
  },
  {
    slug: 'racechip-gts5-dodge-nitro-2006-to-2012-2-8-crd-2777ccm-177hp-130kw-410nm',
    url: 'https://www.racechip.eu/shop/dodge/nitro-2006-to-2012/2-8-crd-2777ccm-177hp-130kw-410nm.html',
  },
  {
    slug: 'racechip-gts5-lamborghini-urus-from-2018-4-0t-3996ccm-650hp-478kw-850nm',
    url: 'https://www.racechip.eu/shop/lamborghini/urus-from-2018/4-0t-3996ccm-650hp-478kw-850nm.html',
  },
  {
    slug: 'racechip-gts5-mclaren-570s-from-2015-3-8-v8-3799ccm-570hp-419kw-600nm',
    url: 'https://www.racechip.eu/shop/mclaren/570s-from-2015/3-8-v8-3799ccm-570hp-419kw-600nm.html',
  },
  {
    slug: 'racechip-gts5-mclaren-570gt-from-2016-3-8-v8-3799ccm-570hp-419kw-600nm',
    url: 'https://www.racechip.eu/shop/mclaren/570gt-from-2016/3-8-v8-3799ccm-570hp-419kw-600nm.html',
  },
  // Second-pass: priceGTS5=679 — only product at this price; doesn't match the
  // RaceChip tier grid (549/569/609/669/739/819/869). Re-scrape to verify.
  {
    slug: 'racechip-gts5-mercedes-benz-s-class-w221-2005-to-2013-s-500-cgi-4663ccm-435hp-320kw-700nm',
    url: 'https://www.racechip.eu/shop/mercedes-benz/s-class-w221-2005-to-2013/s-500-cgi-4663ccm-435hp-320kw-700nm.html',
  },
];

// ─────────────────────────────────────────────────────────────
// Chrome profile warmup (mirror of scrape-racechip.mjs)
// ─────────────────────────────────────────────────────────────

async function openContext() {
  if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'));
  }
  const TEMP_PROFILE = path.join(process.cwd(), 'data', '.chrome-scraper-profile');
  const CHROME_PROFILE = 'C:\\Users\\SASHA\\AppData\\Local\\Google\\Chrome\\User Data';
  if (!fs.existsSync(TEMP_PROFILE)) fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  const defaultDir = path.join(TEMP_PROFILE, 'Default');
  if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });
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
  const context = await chromium.launchPersistentContext(TEMP_PROFILE, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--profile-directory=Default'],
    viewport: { width: 1440, height: 900 },
    timeout: 60000,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  return context;
}

async function passCloudflareIfNeeded(page) {
  let title = await page.title();
  if (title.includes('Attention') || title.includes('moment')) {
    console.log('  ⏳ Cloudflare challenge — please solve it in the browser window...');
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000);
      title = await page.title();
      if (!title.includes('Attention') && !title.includes('moment')) {
        console.log('  ✅ Cloudflare passed');
        return true;
      }
    }
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// Per-page scrape with DOM-aware tier extraction
// ─────────────────────────────────────────────────────────────

async function scrapeOne(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
  await page.waitForTimeout(2500);
  if (!(await passCloudflareIfNeeded(page))) return null;

  // Wait until the CHOOSE buttons are present
  for (let i = 0; i < 8; i++) {
    const ready = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, a, div, span')]
        .filter(el => el.offsetHeight > 0 && /^\s*CHOOSE\s*$/i.test(el.textContent || ''));
      return els.length;
    });
    if (ready >= 3) break;
    await page.waitForTimeout(1000);
  }

  // Click 3rd CHOOSE = MAXIMUM = GTS 5
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, a, div, span')]
      .filter(el => el.offsetHeight > 0 && /^\s*CHOOSE\s*$/i.test(el.textContent || ''));
    if (btns.length >= 3) { btns[2].click(); return 3; }
    if (btns.length > 0) { btns[btns.length - 1].click(); return btns.length; }
    return 0;
  });
  await page.waitForTimeout(1800);

  // ── DOM-aware extraction ──────────────────────────────────
  const data = await page.evaluate(() => {
    const allChoose = [...document.querySelectorAll('button, a, div, span')]
      .filter(el => el.offsetHeight > 0 && /^\s*CHOOSE\s*$/i.test(el.textContent || ''));
    const targetChoose = allChoose.length >= 3 ? allChoose[2] : allChoose[allChoose.length - 1];

    // Walk up to find a tier-card container that holds both the CHOOSE
    // and the tier price. Stop at any ancestor that contains 'EUR' more
    // than once OR has a class matching tier/box/product.
    let tierContainer = null;
    let cur = targetChoose;
    for (let depth = 0; cur && depth < 10; depth++) {
      cur = cur.parentElement;
      if (!cur) break;
      const t = cur.textContent || '';
      const eurCount = (t.match(/EUR/gi) || []).length;
      const hasFromOnly = /^\s*from/i.test(cur.querySelector('[class*="from"]')?.textContent || '');
      const cls = (cur.className && typeof cur.className === 'string') ? cur.className.toLowerCase() : '';
      if (eurCount >= 1 && (cls.includes('tier') || cls.includes('product-box') || cls.includes('price-box') || cls.includes('column') || cls.includes('plan') || cls.includes('package') || depth >= 4)) {
        tierContainer = cur;
        break;
      }
    }

    function parsePriceText(text) {
      if (!text) return 0;
      const m = text.match(/[\d.,]+/g);
      if (!m) return 0;
      const candidates = m.map(s => {
        let n = s;
        if (n.includes(',') && n.includes('.')) {
          if (n.lastIndexOf(',') > n.lastIndexOf('.')) n = n.replace(/\./g, '').replace(',', '.');
          else n = n.replace(/,/g, '');
        } else if (n.includes(',')) {
          n = n.replace(',', '.');
        }
        return parseFloat(n);
      }).filter(n => !isNaN(n) && n > 0);
      return candidates.length ? Math.max(...candidates) : 0;
    }

    // Strategy A: prices found ONLY inside the chosen tier container
    let tierPrices = [];
    if (tierContainer) {
      tierPrices = [...tierContainer.matchAll ? [] : []]; // no-op
      const text = tierContainer.innerText || tierContainer.textContent || '';
      tierPrices = [...text.matchAll(/(\d[\d.,]*)\s*EUR/gi)]
        .map(m => parsePriceText(m[1]))
        .filter(n => n > 50 && n < 3000);
    }

    // Strategy B: full body (same as legacy scraper)
    const bodyText = document.body.innerText;
    const bodyPrices = [...bodyText.matchAll(/(\d[\d.,]*)\s*EUR/gi)]
      .map(m => parsePriceText(m[1]))
      .filter(n => n > 50 && n < 3000);

    // App Control add-on hint
    const appMatch = bodyText.match(/app\s*control\s*[\n\r]*\s*\(optional,?\s*\+?\s*(\d+)\s*EUR\)/i);
    const appControlPrice = appMatch ? parseInt(appMatch[1]) : 59;

    // Tier-card class collection (for diagnostics)
    const tierContainerClass = tierContainer && typeof tierContainer.className === 'string'
      ? tierContainer.className.slice(0, 120) : null;

    // Power gains
    const hpGains = [...bodyText.matchAll(/\+\s*(\d+)\s*HP/gi)].map(m => parseInt(m[1]));
    const nmGains = [...bodyText.matchAll(/\+\s*(\d+)\s*Nm/gi)].map(m => parseInt(m[1]));

    return {
      tierContainerClass,
      tierPrices: [...new Set(tierPrices)].sort((a, b) => a - b),
      bodyPrices: [...new Set(bodyPrices)].sort((a, b) => a - b),
      appControlPrice,
      gainHp: hpGains.length ? Math.max(...hpGains) : 0,
      gainNm: nmGains.length ? Math.max(...nmGains) : 0,
    };
  });

  // ── Decision logic ────────────────────────────────────────
  // 1) Prefer tier container result if it gives a sane base price (< 1500).
  // 2) Else use body prices, drop the outlier when max > 1500 and others < 1500.
  // 3) Add appControlPrice (default 59) to the chosen base.
  let chosenBase = 0;
  let strategy = 'unknown';
  if (data.tierPrices.length > 0) {
    const candidate = Math.max(...data.tierPrices);
    if (candidate > 50 && candidate < 1500) {
      chosenBase = candidate;
      strategy = 'tier-container';
    }
  }
  if (!chosenBase && data.bodyPrices.length > 0) {
    const sorted = [...data.bodyPrices].sort((a, b) => a - b);
    let working = sorted;
    while (working.length > 1) {
      const max = working[working.length - 1];
      const next = working[working.length - 2];
      if (max >= 1500 && max >= 2 * next) working = working.slice(0, -1);
      else break;
    }
    chosenBase = working[working.length - 1] || 0;
    strategy = chosenBase ? 'body-drop-outlier' : 'failed';
  }

  return {
    url,
    strategy,
    tierContainerClass: data.tierContainerClass,
    tierPrices: data.tierPrices,
    bodyPrices: data.bodyPrices,
    chosenBase,
    appControlPrice: data.appControlPrice,
    finalPriceEur: chosenBase ? chosenBase + data.appControlPrice : 0,
    gainHp: data.gainHp,
    gainNm: data.gainNm,
    clickedTierIndex: clicked,
  };
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔧 fix-racechip-outliers — ${TARGETS.length} URLs, APPLY=${APPLY_DB}\n`);
  const context = await openContext();

  // Warmup
  const warm = await context.newPage();
  await warm.goto('https://www.racechip.eu/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await warm.waitForTimeout(2500);
  await passCloudflareIfNeeded(warm);
  await warm.close();

  const page = await context.newPage();
  const results = [];

  for (const t of TARGETS) {
    console.log(`→ ${t.slug}`);
    try {
      const r = await scrapeOne(page, t.url);
      results.push({ ...t, ...r });
      console.log(`  base=${r?.chosenBase} +AC=${r?.appControlPrice} → final=${r?.finalPriceEur}€  via ${r?.strategy}`);
      console.log(`    tierPrices=${JSON.stringify(r?.tierPrices)} bodyPrices=${JSON.stringify(r?.bodyPrices)}`);
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
      results.push({ ...t, error: err.message });
    }
  }
  await context.close();

  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'racechip-outliers-fix.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Wrote data/racechip-outliers-fix.json');

  // Sanity gate. Two valid shapes:
  //   A) tier-container hit, base in [100, 1500): standard 3-tier vehicle.
  //   B) tier marked "-not-available" AND only one unique body price >= 1500:
  //      RaceChip offers a single premium chip for that vehicle, so its real
  //      price genuinely is the high number — leave it as-is.
  function isSane(r) {
    if (!r.finalPriceEur) return false;
    if (r.finalPriceEur > 100 && r.finalPriceEur < 1500) return true;
    const tierAvailable = (r.tierContainerClass || '').includes('-is-available')
      && !(r.tierContainerClass || '').includes('-not-available');
    const onlyOneHighPrice = (r.bodyPrices || []).filter(p => p >= 1000).length === 1
      && (r.bodyPrices || []).every(p => p < 200 || p >= 1000);
    return !tierAvailable && onlyOneHighPrice;
  }
  const sane = results.every(isSane);
  if (!sane) {
    console.log('\n⚠️  Not all prices passed sanity. DB NOT updated.');
    console.log('    Inspect the JSON dump and re-run with --apply if values look correct.');
    process.exit(1);
  }
  console.log('\n✅ All 5 prices look sane.');

  if (!APPLY_DB) {
    console.log('   Re-run with --apply to write them to the DB.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    for (const r of results) {
      const newEur = r.finalPriceEur.toString();
      const before = await prisma.shopProduct.findUnique({
        where: { slug: r.slug },
        select: { id: true, priceEur: true },
      });
      if (!before) { console.log(`  ⚠️  not found: ${r.slug}`); continue; }
      await prisma.shopProduct.update({
        where: { slug: r.slug },
        data: { priceEur: newEur },
      });
      await prisma.shopProductVariant.updateMany({
        where: { productId: before.id },
        data: { priceEur: newEur },
      });
      console.log(`  ✏️  ${r.slug}: ${before.priceEur} → ${newEur} EUR`);
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log('\n🎉 Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
