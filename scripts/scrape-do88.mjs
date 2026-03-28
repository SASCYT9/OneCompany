/**
 * DO88 Product Scraper v3 — Final Production Version
 * 
 * Scrapes do88.se (reliable gtag data), converts SEK → EUR,
 * applies user pricing rules:
 *   - Skip cheap items < 30 EUR (small hoses, fittings)
 *   - Items >= 1000 EUR: same price as DO88
 *   - Items < 1000 EUR: +5% logistics markup
 * 
 * Output: Shopify-compatible CSV for the admin import tool.
 * Usage: node scripts/scrape-do88.mjs
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.do88.se';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const OUTPUT_CSV = path.join(process.cwd(), 'do88-products.csv');
const OUTPUT_JSON = path.join(process.cwd(), 'do88-products.json');

// Current approximate SEK to EUR rate (1 EUR ≈ 11.3 SEK)
const SEK_TO_EUR = 1 / 11.3;

// DO88 SEK prices from gtag are ex-VAT (företag pricelist).
// Swedish VAT is 25%. Consumer incl VAT = price * 1.25
// Then convert to EUR.
const INCLUDE_VAT_MULTIPLIER = 1.25;

// Pricing rules
const MIN_PRICE_EUR = 30;  // Skip cheap items
const HIGH_PRICE_THRESHOLD_EUR = 1000;  // No markup above this
const LOGISTICS_MARKUP = 0.05;  // 5% for items under 1000 EUR

const DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'OneCompany-DO88-Importer/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function getSitemapUrls() {
  console.log('📡 Fetching sitemap...');
  const xml = await fetchPage(SITEMAP_URL);
  const urls = [];
  const regex = /<loc>(https?:\/\/[^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  console.log(`   Found ${urls.length} URLs in sitemap`);
  return urls;
}

function extractProductsFromHtml(html, pageUrl) {
  const products = [];

  // Extract from embedded gtag view_item_list data
  const gtagRegex = /item_id:\s*"([^"]+)",\s*\n\s*item_name:\s*"([^"]+)",[\s\S]*?price:\s*([\d.]+),\s*\n\s*quantity/g;
  let gtagMatch;
  const gtagProducts = {};
  
  while ((gtagMatch = gtagRegex.exec(html)) !== null) {
    const itemId = gtagMatch[1];
    const itemName = gtagMatch[2];
    const priceSEK_exVAT = parseFloat(gtagMatch[3]);
    
    if (!gtagProducts[itemId]) {
      const blockStart = Math.max(0, gtagMatch.index - 50);
      const blockEnd = Math.min(html.length, gtagMatch.index + gtagMatch[0].length + 200);
      const block = html.substring(blockStart, blockEnd);
      
      const cat1Match = block.match(/item_category:\s*"([^"]+)"/);
      const cat2Match = block.match(/item_category2:\s*"([^"]+)"/);
      const cat3Match = block.match(/item_category3:\s*"([^"]+)"/);
      
      // Convert: SEK ex-VAT → SEK incl VAT → EUR
      const priceSEK_inclVAT = priceSEK_exVAT * INCLUDE_VAT_MULTIPLIER;
      const priceEUR = priceSEK_inclVAT * SEK_TO_EUR;
      
      gtagProducts[itemId] = {
        sku: itemId,
        title: itemName,
        priceSEK_exVAT,
        priceSEK_inclVAT: Math.round(priceSEK_inclVAT * 100) / 100,
        priceEUR_raw: Math.round(priceEUR * 100) / 100,
        category: [cat1Match?.[1], cat2Match?.[1], cat3Match?.[1]].filter(Boolean).join(' > '),
      };
    }
  }

  // Extract images
  const imgRegex = /<div class="PT_Bildruta[^"]*"[^>]*>.*?<img[^>]*src="([^"]*\/bilder\/artiklar\/[^"]*)"[^>]*>/g;
  let imgMatch;
  const imageMap = {};
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const imgSrc = imgMatch[1].split('?')[0];
    const filenameMatch = imgSrc.match(/\/([^/]+?)(?:_S|_M|_L)?\.(?:jpg|png|webp)$/i);
    if (filenameMatch) {
      imageMap[filenameMatch[1]] = `${BASE_URL}${imgSrc.replace('/liten/', '/stor/')}`;
    }
  }
  
  // Merge and apply pricing logic
  for (const [sku, product] of Object.entries(gtagProducts)) {
    const eurRaw = product.priceEUR_raw;
    
    // Skip cheap items
    if (eurRaw < MIN_PRICE_EUR) continue;
    
    // Apply markup
    let finalPriceEUR;
    if (eurRaw >= HIGH_PRICE_THRESHOLD_EUR) {
      finalPriceEUR = eurRaw; // Same price
    } else {
      finalPriceEUR = eurRaw * (1 + LOGISTICS_MARKUP); // +5%
    }
    finalPriceEUR = Math.round(finalPriceEUR * 100) / 100;
    
    const imageUrl = imageMap[sku] || '';
    
    products.push({
      ...product,
      priceEUR_final: finalPriceEUR,
      imageUrl,
      sourceUrl: pageUrl,
    });
  }

  return products;
}

function escapeCSV(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function productsToShopifyCsv(products) {
  const header = [
    'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type',
    'Tags', 'Published', 'Option1 Name', 'Option1 Value',
    'Variant SKU', 'Variant Price', 'Variant Compare At Price',
    'Image Src', 'Image Position', 'Status',
  ].join(',');

  const rows = products.map((p) => {
    const handle = `do88-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const topCategory = p.category.split(' > ')[0] || 'Cooling';
    const tags = ['DO88', topCategory].filter(Boolean).join(', ');
    const body = `<p>${p.title}. Category: ${p.category}. Brand: DO88. Made in Sweden.</p>`;
    
    return [
      escapeCSV(handle),
      escapeCSV(p.title),
      escapeCSV(body),
      'DO88',
      escapeCSV(p.category),
      'Performance Part',
      escapeCSV(tags),
      'true',
      'Title',
      'Default Title',
      escapeCSV(p.sku),
      escapeCSV(String(p.priceEUR_final)),
      escapeCSV(String(p.priceEUR_raw)),
      escapeCSV(p.imageUrl),
      '1',
      'active',
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

async function main() {
  console.log('🔧 DO88 Product Scraper v3 (EUR pricing + markup)');
  console.log('==================================================');
  console.log(`   SEK→EUR rate: ${SEK_TO_EUR.toFixed(4)}`);
  console.log(`   Min price filter: €${MIN_PRICE_EUR}`);
  console.log(`   High-price threshold: €${HIGH_PRICE_THRESHOLD_EUR} (no markup above)`);
  console.log(`   Logistics markup: +${LOGISTICS_MARKUP * 100}%\n`);

  try {
    const sitemapUrls = await getSitemapUrls();
    const productPageUrls = sitemapUrls.filter(
      (url) => url.includes('/artiklar/') || url.includes('/articles/')
    );
    console.log(`🎯 Found ${productPageUrls.length} product pages\n`);

    const allProducts = [];
    let pageCount = 0;
    let totalFound = 0;
    let skippedCheap = 0;

    for (const url of productPageUrls) {
      pageCount++;
      const shortUrl = url.replace(BASE_URL, '').substring(0, 70);
      process.stdout.write(`  [${pageCount}/${productPageUrls.length}] ${shortUrl}...`);
      
      try {
        const html = await fetchPage(url);
        const products = extractProductsFromHtml(html, url);
        allProducts.push(...products);
        totalFound += products.length;
        
        if (products.length > 0) {
          console.log(` ✅ ${products.length} (total: ${totalFound})`);
        } else {
          console.log(` ⬜`);
        }
      } catch (err) {
        console.log(` ❌ ${err.message}`);
      }
      
      await sleep(DELAY_MS);
    }

    // Deduplicate by SKU
    const uniqueProducts = new Map();
    for (const p of allProducts) {
      if (!uniqueProducts.has(p.sku)) {
        uniqueProducts.set(p.sku, p);
      }
    }

    const finalProducts = Array.from(uniqueProducts.values());
    
    // Stats
    const highPriceCount = finalProducts.filter(p => p.priceEUR_raw >= HIGH_PRICE_THRESHOLD_EUR).length;
    const markupCount = finalProducts.filter(p => p.priceEUR_raw < HIGH_PRICE_THRESHOLD_EUR).length;
    const avgPrice = finalProducts.reduce((sum, p) => sum + p.priceEUR_final, 0) / finalProducts.length;

    console.log(`\n📊 Results:`);
    console.log(`   Pages scraped: ${pageCount}`);
    console.log(`   Total raw products: ${allProducts.length}`);
    console.log(`   Unique products: ${finalProducts.length}`);
    console.log(`   ├─ ≥ €${HIGH_PRICE_THRESHOLD_EUR} (no markup): ${highPriceCount}`);
    console.log(`   └─ < €${HIGH_PRICE_THRESHOLD_EUR} (+5%):      ${markupCount}`);
    console.log(`   Avg final price:   €${avgPrice.toFixed(2)}`);

    // Write CSV
    const csv = productsToShopifyCsv(finalProducts);
    fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8');
    console.log(`\n💾 CSV: ${OUTPUT_CSV}`);

    // Write JSON
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalProducts, null, 2), 'utf-8');
    console.log(`   JSON: ${OUTPUT_JSON}`);
    console.log(`\n✨ Import via Admin > Shop > Import with supplier "DO88".`);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
