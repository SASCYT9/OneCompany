#!/usr/bin/env node
/**
 * Rich-section scraper for do88.se product pages.
 *
 * Unlike the original scrape-do88-pages.mjs (which only captured the
 * lead headline + 4 bullets), this extracts the full marketing/technical
 * description: Bakgrund / Nyckelegenskaper / Överväganden /
 * Den färdiga produkten + variants list. ~3000–4000 chars per page.
 *
 * Source-of-truth URL list: scripts/do88/scraped/do88-pages.json
 * (the old scraper's URL discovery is fine — it found 588 SKU pages).
 *
 * Usage:
 *   node scripts/do88/scrape-do88-rich.mjs                       # full
 *   node scripts/do88/scrape-do88-rich.mjs --limit 5             # first 5
 *   node scripts/do88/scrape-do88-rich.mjs --skus LF-210-ST-66r,WC-430,ICM-450-K
 *   node scripts/do88/scrape-do88-rich.mjs --our-skus            # only SKUs in do88-products-v4.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SCRAPED_DIR = path.join(__dirname, 'scraped');
const URL_SOURCE = path.join(SCRAPED_DIR, 'do88-pages.json');
const OUR_PRODUCTS = path.join(ROOT, 'do88-products-v4.json');
const OUTPUT_FILE = path.join(SCRAPED_DIR, 'do88-pages-rich.json');
const CONCURRENCY = 6;

const args = process.argv.slice(2);
function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const LIMIT = argVal('--limit') ? parseInt(argVal('--limit'), 10) : Infinity;
const SKU_FILTER = argVal('--skus') ? new Set(argVal('--skus').split(',').map((s) => s.trim().toUpperCase())) : null;
const ONLY_OUR_SKUS = args.includes('--our-skus');

function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10);
      return n > 0 && n < 0x10000 ? String.fromCharCode(n) : '';
    })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const SECTION_NAMES = [
  // Order: more specific first. No \b — JS \b doesn't fire on Ö/Ä/Å.
  { key: 'bakgrund', re: /^Bakgrund(?:en)?\s*$/i },
  { key: 'nyckelegenskaper', re: /^(?:Nyckelegenskaper|Nyckeltal)\s*$/i },
  { key: 'overvaganden', re: /^(?:Överväganden|Övervägande|Tankar\s+bakom)\s*$/i },
  { key: 'fardigaProdukten', re: /^(?:Den\s+färdiga\s+produkten|Färdig\s+produkt)\s*$/i },
  { key: 'utforanden', re: /^(?:Utföranden|Detta\s+kit)\s*$/i },
];

function cleanBody(s) {
  return s.replace(/\n+/g, '\n').replace(/^[\s\n]+|[\s\n]+$/g, '').trim();
}

function extractRichDescription(html) {
  const summaryIdx = html.indexOf('Produktbeskrivning</summary>');
  if (summaryIdx < 0) return null;
  const afterSummary = html.slice(summaryIdx);
  const divMatch = afterSummary.match(/<div\s+class="col-md-12">([\s\S]*?)<\/div>/);
  if (!divMatch) return null;
  const block = divMatch[1];

  // Replace <br/> with newlines, drop tags except <strong>, decode entities.
  let text = block
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?!strong\b)[a-z][^>]*>/gi, ' ')
    .replace(/[ \t]+/g, ' ');
  text = decodeEntities(text);

  const parts = text.split(/<strong>([^<]+)<\/strong>/);
  const result = { headline: '', sections: {} };
  if (parts[0] && parts[0].trim()) {
    result.headline = parts[0].trim().replace(/\s*\n\s*/g, ' ');
  }
  for (let i = 1; i < parts.length; i += 2) {
    const headerRaw = parts[i].trim();
    const bodyRaw = (parts[i + 1] || '').trim();
    if (!headerRaw) continue;

    let matched = null;
    for (const sn of SECTION_NAMES) {
      if (sn.re.test(headerRaw)) {
        matched = sn.key;
        break;
      }
    }

    if (!matched && i === 1 && !result.headline) {
      result.headline = headerRaw;
      continue;
    }

    if (matched) {
      result.sections[matched] = cleanBody(bodyRaw);
    } else {
      result.sections[`other:${headerRaw}`] = cleanBody(bodyRaw);
    }
  }

  if (result.sections.nyckelegenskaper) {
    const lines = result.sections.nyckelegenskaper.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    result.sections.bullets = lines
      .filter((l) => /^[-•·*]/.test(l))
      .map((l) => l.replace(/^[-•·*]\s*/, '').trim())
      .filter((l) => l.length > 3);
  }

  if (result.sections.fardigaProdukten) {
    const variants = [];
    for (const m of result.sections.fardigaProdukten.matchAll(/(?:^|\n)\s*(\d+)\.\s+([^\n]+)/g)) {
      variants.push(m[2].trim());
    }
    if (variants.length) result.sections.variants = variants;
  }

  return result;
}

function extractH1(html) {
  const h2 = html.match(/<h2[^>]*id=["']ArtikelnamnFalt["'][^>]*>([\s\S]*?)<\/h2>/i);
  if (h2) return decodeEntities(h2[1].replace(/<[^>]+>/g, '').trim());
  return null;
}

function extractSku(html) {
  // From JSON-LD which has clean SKU
  const jsonLdSku = html.match(/"sku"\s*:\s*"([A-Za-z0-9_-]+)"/);
  if (jsonLdSku) return jsonLdSku[1];
  // Fallback: image filename
  const imgMatch = html.match(/\/bilder\/artiklar\/([A-Za-z0-9][A-Za-z0-9_-]+)\.jpg/);
  return imgMatch ? imgMatch[1] : null;
}

function extractFitment(html) {
  // "Passar" block — vehicle compatibility
  const idx = html.indexOf('Passar</strong>');
  if (idx < 0) return null;
  const tail = html.slice(idx + 'Passar</strong>'.length, idx + 4000);
  const stopMarkers = ['<strong>', '</details>', '<summary'];
  let endIdx = tail.length;
  for (const sm of stopMarkers) {
    const i = tail.indexOf(sm);
    if (i >= 0 && i < endIdx) endIdx = i;
  }
  const block = tail.slice(0, endIdx);
  const text = decodeEntities(block.replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  return text.length > 5 ? text.slice(0, 400) : null;
}

function extractOeRefs(html) {
  const idx = html.indexOf('OE-ref');
  if (idx < 0) return [];
  const tail = html.slice(idx, idx + 4000);
  const text = decodeEntities(tail.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '));
  const matches = text.match(/[A-Z0-9][A-Z0-9._-]{4,18}/g) || [];
  return [...new Set(matches.filter((m) => /[A-Z]/.test(m) && /\d/.test(m)))].slice(0, 12);
}

async function fetchOne(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneCompany/1.0; +https://onecompany.global)',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.5',
      },
    });
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    const html = await res.text();
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    const rich = extractRichDescription(stripped);
    return {
      url,
      sku: extractSku(stripped),
      title: extractH1(stripped),
      headline: rich?.headline || null,
      sections: rich?.sections || null,
      fitment: extractFitment(stripped),
      oeRefs: extractOeRefs(stripped),
      richChars: rich
        ? Object.values(rich.sections || {})
            .filter((v) => typeof v === 'string')
            .reduce((sum, v) => sum + v.length, 0)
        : 0,
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
      const r = await fetchOne(urls[idx]);
      results.push(r);
      onProgress(results.length, urls.length, r);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const oldScrape = JSON.parse(await fs.readFile(URL_SOURCE, 'utf8'));
  let urls = oldScrape.pages.filter((p) => p.url && p.sku).map((p) => ({ url: p.url, sku: p.sku.toUpperCase() }));

  if (ONLY_OUR_SKUS) {
    const ourProducts = JSON.parse(await fs.readFile(OUR_PRODUCTS, 'utf8'));
    const ourSkus = new Set(ourProducts.map((p) => (p.sku || '').toUpperCase()).filter(Boolean));
    urls = urls.filter((u) => ourSkus.has(u.sku));
    console.log(`[filter] our-skus: ${urls.length} URLs match ${ourSkus.size} of our SKUs`);
  }

  if (SKU_FILTER) {
    urls = urls.filter((u) => SKU_FILTER.has(u.sku));
    console.log(`[filter] skus: ${urls.length} URLs match`);
  }

  if (urls.length > LIMIT) urls = urls.slice(0, LIMIT);

  console.log(`[scrape] ${urls.length} pages, concurrency ${CONCURRENCY}`);

  const startTime = Date.now();
  const results = await processBatch(
    urls.map((u) => u.url),
    (done, total, last) => {
      const tag = last.error ? `ERR ${last.error}` : `${last.richChars} chars`;
      process.stdout.write(`\r[${done}/${total}] ${last.sku || '?'} (${tag})`.padEnd(80) + '');
    }
  );
  process.stdout.write('\n');

  const withRich = results.filter((r) => !r.error && r.richChars > 200).length;
  const withoutRich = results.filter((r) => !r.error && r.richChars <= 200).length;
  const errored = results.filter((r) => r.error).length;
  console.log(`[done] rich: ${withRich}, thin: ${withoutRich}, errored: ${errored}, time ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      {
        scrapedAt: new Date().toISOString(),
        totalUrls: urls.length,
        withRich,
        withoutRich,
        errored,
        pages: results,
      },
      null,
      2
    )
  );
  console.log(`[write] ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
