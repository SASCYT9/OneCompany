#!/usr/bin/env node
/**
 * Scrape do88.se rich product pages, extract canonical product data, and
 * produce a per-SKU JSON map for downstream enrichment.
 *
 * Usage:
 *   node scripts/do88/scrape-do88-pages.mjs            # full scrape
 *   node scripts/do88/scrape-do88-pages.mjs --limit 50 # first 50 pages
 *
 * Output: scripts/do88/scraped/do88-pages.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'scraped');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'do88-pages.json');
const SITEMAP_URL = 'https://www.do88.se/sitemap.xml';
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

function decodeHtmlEntities(s) {
  return String(s ?? '')
    .replace(/&#229;/g, 'å').replace(/&#228;/g, 'ä').replace(/&#246;/g, 'ö')
    .replace(/&#197;/g, 'Å').replace(/&#196;/g, 'Ä').replace(/&#214;/g, 'Ö')
    .replace(/&#176;/g, '°').replace(/&#160;/g, ' ')
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“').replace(/&#8221;/g, '”')
    .replace(/&aring;/g, 'å').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö')
    .replace(/&Aring;/g, 'Å').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    // Numeric entities — fall through to unicode codepoint
    .replace(/&#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10);
      return n > 0 && n < 0x10000 ? String.fromCharCode(n) : '';
    })
    // Drop unknown named entities we haven't mapped
    .replace(/&[a-zA-Z]+;/g, ' ');
}

function stripTags(s) {
  return decodeHtmlEntities(String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
}

function findBlock(html, startMarker, endMarkers) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx < 0) return null;
  const tail = html.slice(startIdx + startMarker.length);
  let endIdx = tail.length;
  for (const em of endMarkers) {
    const idx = tail.indexOf(em);
    if (idx >= 0 && idx < endIdx) endIdx = idx;
  }
  return tail.slice(0, endIdx);
}

function extractH1(html) {
  // do88 puts the product name in <h2 id="ArtikelnamnFalt">
  const h2 = html.match(/<h2[^>]*id=["']ArtikelnamnFalt["'][^>]*>([\s\S]*?)<\/h2>/i);
  if (h2) return stripTags(h2[1]);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return h1 ? stripTags(h1[1]) : null;
}

function extractArticleNumber(html) {
  // SKU is most reliably encoded in the MAIN product image URL.
  // Look for og:image (canonical) first — that always points to the
  // main product image. Then fall back to the first image without liten/_S
  // suffix, then to zoomed/thumbnail patterns. Many do88 pages list
  // related-product thumbnails BEFORE the main image, so the first
  // /liten/<sku>_S.jpg can mismatch (e.g. show A3L60-89 for an Garrett
  // core that's actually 703520-6005).
  const ogMatch = html.match(/og:image[^"]*"\s+content="[^"]*\/bilder\/artiklar\/(?:zoom\/|liten\/)?([A-Za-z][A-Za-z0-9_\-]{1,40})(?:_[SML12])?\.jpg/i);
  if (ogMatch) return ogMatch[1];
  // Allow leading digits too (Garrett SKUs like 703520-6005 start with digits).
  const fullMatch = html.match(/\/bilder\/artiklar\/([A-Za-z0-9][A-Za-z0-9_\-]{2,40})\.jpg/i);
  if (fullMatch) return fullMatch[1];
  const zoomMatch = html.match(/\/bilder\/artiklar\/zoom\/([A-Za-z0-9][A-Za-z0-9_\-]{2,40})_\d+\.jpg/i);
  if (zoomMatch) return zoomMatch[1];
  const litenMatch = html.match(/\/bilder\/artiklar\/liten\/([A-Za-z0-9][A-Za-z0-9_\-]{2,40})_S\.jpg/i);
  if (litenMatch) return litenMatch[1];
  const dataAttr = html.match(/data-artnr=["']([A-Za-z0-9_\-]+)["']/i);
  return dataAttr ? dataAttr[1] : null;
}

function extractParagraphsFromBlock(block) {
  if (!block) return [];
  // Replace <br> with newlines so we keep paragraph breaks
  const normalized = block.replace(/<br\s*\/?>/gi, '\n');
  const lines = stripTags(normalized).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines;
}

function softStripTags(s) {
  // Like stripTags but preserve newlines (do not collapse to single line).
  return decodeHtmlEntities(
    String(s ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n'),
  ).trim();
}

function extractKeyFeatures(html) {
  // Look for "Nyckelegenskaper:" — content follows as <br />-separated lines
  // each starting with "-".
  const idx = html.indexOf('Nyckelegenskaper');
  if (idx < 0) return [];
  const tail = html.slice(idx, idx + 6000);
  // Stop at next bold heading or accordion separator
  const stopMarkers = ['Bakgrund', 'Cellpaket från', 'Luftstyrningar', 'Prestanda',
    'Passar', 'Komplettera ditt köp', 'OE-ref', 'Liknande', '</summary>', '<summary'];
  let endIdx = tail.length;
  for (const sm of stopMarkers) {
    const i = tail.indexOf(sm, 20);
    if (i > 0 && i < endIdx) endIdx = i;
  }
  const block = tail.slice(0, endIdx);
  // Replace <br/> with newlines, strip tags but preserve newlines
  const text = softStripTags(block.replace(/<br\s*\/?>/gi, '\n'));
  // Lines starting with "-" are bullets
  const lines = text.split(/\n+/).map((l) => l.trim());
  return lines
    .filter((l) => /^[-•·*]/.test(l))
    .map((l) => l.replace(/^[-•·*]\s*/, '').trim())
    .filter((l) => l.length > 5 && l.length < 280);
}

function extractDescription(html) {
  // Produktbeskrivning is inside <summary>, content is the next <p> or
  // text block until <strong>Nyckelegenskaper or </details>.
  const startMarker = 'Produktbeskrivning</summary>';
  const idx = html.indexOf(startMarker);
  if (idx < 0) return [];
  const tail = html.slice(idx + startMarker.length, idx + 12000);
  const stopMarkers = ['Nyckelegenskaper', 'Bakgrund', 'Cellpaket från',
    '</details>', '<summary'];
  let endIdx = tail.length;
  for (const sm of stopMarkers) {
    const i = tail.indexOf(sm);
    if (i >= 0 && i < endIdx) endIdx = i;
  }
  const block = tail.slice(0, endIdx);
  const text = stripTags(block.replace(/<br\s*\/?>/gi, '\n'));
  return text.split(/\n+/).map((l) => l.trim())
    .filter((l) => l.length > 30 && l.length < 1500);
}

function extractFitment(html) {
  const block = findBlock(html, 'Passar', ['OE-ref', 'Komplettera', 'Liknande', 'Recensioner', '<h2', '<h3']);
  if (!block) return null;
  const lines = extractParagraphsFromBlock(block).filter((l) => l.length < 200);
  return lines.length ? lines.join(' · ') : null;
}

function extractOeRefs(html) {
  const block = findBlock(html, 'OE-ref', ['Komplettera', 'Liknande', 'Recensioner', '<h2', '<h3']);
  if (!block) return [];
  // OE numbers are alphanumeric, often with spaces between them
  const text = stripTags(block);
  const matches = text.match(/[A-Z0-9][A-Z0-9._\-]{4,15}/g) || [];
  // Filter out common false positives
  return matches
    .filter((m) => /[A-Z]/.test(m) && /\d/.test(m))
    .filter((m) => !['Komplettera', 'Liknande', 'Ersätter'].includes(m))
    .slice(0, 12);
}

// Chassis category indexes that the do88 sitemap is missing entries for.
// Crawling these surfaces vehicle-specific products (e.g. ICM-400 lives on
// 992-turbo but isn't in /sitemap.xml).
const CHASSIS_INDEX_URLS = [
  // Porsche
  'https://www.do88.se/sv/artiklar/slangkit/porsche/992-turbo/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/9921/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/9922-carrera-911/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/9912/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/9912-carrera-t-911/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/991/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/9971/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/9972/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/996/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/993/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/porsche/964/index.html',
  // BMW
  'https://www.do88.se/sv/artiklar/slangkit/bmw/g80-g87-s58-m2-m3-m4/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/bmw/g20-g29-g42/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/bmw/f8x-m2c-m3-m4/index.html',
  // Audi
  'https://www.do88.se/sv/artiklar/slangkit/audi/rs6-rs7-40-v8-tfsi-c8/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/audi/rs3/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/audi/a3-s3-8v-12-tt-8s-15-/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/audi/a3-s3-8y-21-/index.html',
  // VW
  'https://www.do88.se/sv/artiklar/slangkit/vw/golf-mk-7-mk-75-mqb-13-19/index.html',
  'https://www.do88.se/sv/artiklar/slangkit/vw/golf-mk-8/index.html',
];

async function fetchChassisIndexUrls() {
  const collected = new Set();
  for (const indexUrl of CHASSIS_INDEX_URLS) {
    try {
      const res = await fetch(indexUrl);
      if (!res.ok) continue;
      const html = await res.text();
      for (const m of html.matchAll(/href="(\/sv\/artiklar\/[a-z0-9-]+\.html)"/g)) {
        collected.add(`https://www.do88.se${m[1]}`);
      }
    } catch (err) {
      // ignore — page might be down or moved
    }
  }
  return [...collected];
}

async function fetchSitemap() {
  console.log(`[fetch] ${SITEMAP_URL}`);
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const urls = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    urls.push(m[1]);
  }
  const productUrls = urls.filter(
    (u) => u.includes('/sv/artiklar/') && !u.endsWith('/index.html'),
  );

  // Augment with URLs found via chassis category indexes (sitemap is
  // incomplete — e.g. ICM-400 isn't listed there).
  const chassisUrls = await fetchChassisIndexUrls();
  console.log(`[chassis-index] discovered ${chassisUrls.length} additional product URLs`);
  const merged = new Set([...productUrls, ...chassisUrls]);

  // Prioritise URLs likely to have rich descriptions (kits / vehicle-specific
  // products). Pure component pages (silicone elbows, hose clamps) carry no
  // copy worth importing — skip them unless --all is passed.
  const wantsAll = process.argv.includes('--all');
  const all = [...merged];
  if (wantsAll) return all;
  const richPattern =
    /(intercooler|big-?pack|bigpack|intag|insug|carbon|kolfiber|oil-?cooler|oljekylare|y-?(?:r[oö]r|pipe)|charge|laddluftk|laddluft|plenum|porsche|bmw|audi|volkswagen|volvo|saab|toyota|supra|yaris|mercedes|amg|renault|alpine|seat|skoda|tryckslangar|inloppsslangar|insugssystem|intercoolerror|tryckror|silikonslang.*-4m|silikonslang-flexibel|silikonslang-armerad|setrab|garrett|gfb|vta|bmc-cda|cda-carbon)/i;
  const filtered = all.filter((u) => richPattern.test(u));
  return filtered;
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneCompany/1.0; +https://onecompany.global)',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.5',
      },
    });
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    const html = await res.text();

    // Strip script/style early
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    return {
      url,
      title: extractH1(stripped),
      sku: extractArticleNumber(stripped),
      description: extractDescription(stripped),
      keyFeatures: extractKeyFeatures(stripped),
      fitment: extractFitment(stripped),
      oeRefs: extractOeRefs(stripped),
    };
  } catch (err) {
    return { url, error: err.message };
  }
}

async function processBatch(urls, onProgress) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= urls.length) return;
      const url = urls[idx];
      const result = await fetchPage(url);
      results.push(result);
      onProgress(results.length, urls.length, result);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const productUrls = await fetchSitemap();
  console.log(`[sitemap] discovered ${productUrls.length} product page URLs`);
  const targetUrls = productUrls.slice(0, LIMIT);
  console.log(`[scrape] processing ${targetUrls.length} pages with concurrency ${CONCURRENCY}`);

  const startTime = Date.now();
  const results = await processBatch(targetUrls, (done, total, last) => {
    if (done % 25 === 0 || done === total) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (done / Math.max(1, parseFloat(elapsed))).toFixed(1);
      const skuLabel = last?.sku ?? '?';
      const titleLabel = (last?.title ?? '?').slice(0, 60);
      console.log(`[progress] ${done}/${total} (${rate}/s) — ${skuLabel}: ${titleLabel}`);
    }
  });

  // Index by SKU when available
  const bySku = {};
  let withSku = 0;
  let withDescription = 0;
  for (const r of results) {
    if (r.error) continue;
    if (r.sku) {
      bySku[r.sku.toUpperCase()] = r;
      withSku++;
      if (r.description?.length || r.keyFeatures?.length) withDescription++;
    }
  }

  const summary = {
    scrapedAt: new Date().toISOString(),
    totalUrls: targetUrls.length,
    withSku,
    withDescription,
    pages: results,
    bySku,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`\n[done] wrote ${OUTPUT_FILE}`);
  console.log(`       total pages: ${results.length}`);
  console.log(`       with SKU: ${withSku}`);
  console.log(`       with description/features: ${withDescription}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
