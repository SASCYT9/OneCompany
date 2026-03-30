/**
 * Brabus Product Scraper v1
 * 
 * Extracts prices from German Brabus site (authoritative EUR pricing).
 * Extracts titles, descriptions, and images from English Brabus site.
 * 
 * Usage: 
 *   node scripts/scrape-brabus.mjs
 *   node scripts/scrape-brabus.mjs --limit 10
 */

import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const SITEMAP_DE = 'https://www.brabus.com/de-de/sitemap.xml';
const OUTPUT_CSV = path.join(process.cwd(), 'brabus-products.csv');
const OUTPUT_JSON = path.join(process.cwd(), 'brabus-products.json');

const DELAY_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function getTuningUrls() {
  console.log('📡 Fetching German sitemap...');
  const xml = await fetchPage(SITEMAP_DE);
  const urls = [...xml.matchAll(/<loc>([^<]+\/tuning\/[^<]+\.html)<\/loc>/g)].map(m => m[1]);
  // Filter out non-product URLs like 'uebersicht.html', 'more-brands.html', etc
  let productUrls = urls.filter(u => {
    const lastPart = u.split('/').pop();
    // Reject overview pages
    if (['uebersicht.html', 'more-brands.html', 'auf-basis-mercedes.html'].includes(lastPart)) return false;
    // Reject simple brand overviews
    if (!lastPart.match(/[0-9-]/)) return false;
    return true;
  });
  
  // PRECISION FOCUS: Instead of tarpitting 2200 URLs across A-Z classes, 
  // explicitly target flagship vehicles for the Premium UI (G-Class, S-Class, Porsche, RR)
  productUrls = productUrls.filter(u => 
    u.includes('g-klasse') || 
    u.includes('w-46') || 
    u.includes('s-klasse') || 
    u.includes('porsche') || 
    u.includes('rr-') || 
    u.includes('rolls') ||
    u.includes('-rad') ||
    u.includes('monoblock')
  );

  // Deduplicate
  return [...new Set(productUrls)];
}

function parsePrice(priceText) {
  if (!priceText) return 0;
  // Ex: "2.677,50 EUR" or "2,677.50 EUR" or "Preis auf Anfrage"
  // Remove EUR, keeping numbers and commas/dots
  let clean = priceText.replace(/[^\d.,]/g, '');
  if (!clean) return 0;
  
  // Handle European format "2.677,50" -> "2677.50"
  if (clean.includes(',') && clean.includes('.')) {
    // If last punctuation is comma, it's a decimal "2.677,50"
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // Last is dot "2,677.50"
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // Only comma "2677,50"
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean) || 0;
}

function extractProductData(htmlDe, htmlEn, urlDe) {
  const $de = cheerio.load(htmlDe);
  const $en = cheerio.load(htmlEn);
  
  // Extract Price from German JSON-LD as primary source
  let priceEUR = 0;
  $de('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($de(el).html() || '{}');
      if (data['@type'] === 'Product' && data.offers && data.offers.price) {
        priceEUR = parseFloat(data.offers.price);
      }
    } catch(e) {}
  });

  // Fallback to text if JSON-LD fails
  if (!priceEUR || priceEUR === 0) {
    const priceText = $de('.price').first().text().trim() || $de('.price-wrapper').first().text().trim();
    priceEUR = parsePrice(priceText);
  }
  
  // Extract Title, Desc, Images from English
  const title = $en('h1').text().trim();
  
  const urlParts = urlDe.split('/');
  const sku = urlParts[urlParts.length - 1].replace('.html', '').toUpperCase();
  
  // Category path inference
  // e.g. https://www.brabus.com/de-de/cars/tuning/auf-basis-mercedes/uebersicht/artikel/p/g-klasse/w-463a/amg-g-63-463a/464-b40s-800-99.html
  // Category logic: grab the folders right before the SKU
  const catKeywords = ['g-klasse', 'c-klasse', 'e-klasse', 's-klasse', 'porsche', 'rolls-royce'];
  let category = 'Brabus Tuning';
  for (const cw of catKeywords) {
    if (urlDe.includes(`/${cw}/`)) {
      category = `Brabus ${cw.replace('-klasse', '-Class').toUpperCase()}`;
      break;
    }
  }

  let description = '';
  $en('p, div.text, div.description, div.product-info-description').each((i, el) => {
    const t = $en(el).text().trim().replace(/\s+/g, ' ');
    if (t.length > 80 && t.length < 1500 && !t.includes('Menu') && !t.includes('Cookies')) {
      description += `<p>${t}</p>`;
    }
  });

  const images = [];
  $en('img').each((i, el) => {
    let src = $en(el).attr('src') || $en(el).attr('data-src') || $en(el).attr('srcset');
    if (src && (src.includes('.jpg') || src.includes('.png')) && !src.includes('logo')) {
      src = src.split(' ')[0]; // Handle srcset
      if (!src.startsWith('http')) {
        src = src.startsWith('/') ? `https://www.brabus.com${src}` : `https://www.brabus.com/${src}`;
      }
      if (!images.includes(src)) images.push(src);
    }
  });

  return {
    sku,
    title,
    priceEUR_final: priceEUR,
    priceEUR_raw: priceEUR,
    category,
    description,
    images,
    sourceUrlDe: urlDe,
  };
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
    const handle = `brabus-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const tags = ['Brabus', p.category].filter(Boolean).join(', ');
    const body = `${p.description}`;
    const imageUrl = p.images.length > 0 ? p.images[0] : '';
    
    return [
      escapeCSV(handle),
      escapeCSV(p.title),
      escapeCSV(body),
      'Brabus',
      escapeCSV(p.category),
      'Premium Tuning',
      escapeCSV(tags),
      'true',
      'Title',
      'Default Title',
      escapeCSV(p.sku),
      escapeCSV(String(p.priceEUR_final)),
      escapeCSV(String(p.priceEUR_raw)),
      escapeCSV(imageUrl),
      '1',
      'active',
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

import pLimit from 'p-limit';

async function main() {
  const args = process.argv.slice(2);
  const limitArgIndex = args.indexOf('--limit');
  const urlLimit = limitArgIndex > -1 ? parseInt(args[limitArgIndex + 1], 10) : 0;
  
  console.log('🔧 Brabus dual-lang Product Scraper (DE prices, EN desc)');
  
  try {
    const urlsDe = await getTuningUrls();
    const targetUrls = urlLimit > 0 ? urlsDe.slice(0, urlLimit) : urlsDe;
    
    const allProducts = [];
    let processed = 0;
    const limit = pLimit(15); // 15 concurrent connections to respect Cloudflare limits (2 reqs per item)

    console.log(`⏳ Starting fast concurrent extraction of ${targetUrls.length} vehicle components (Dual-Lang)...`);

    const promises = targetUrls.map((urlDe) =>
      limit(async () => {
        try {          
          const htmlDe = await fetchPage(urlDe);
          if (!htmlDe) {
            processed++;
            return null; // 404
          }

          // Fetch official English catalog for pristine titles and descriptions
          let urlEn = urlDe.replace('/de-de/', '/en-int/');
          urlEn = urlEn.replace('/auf-basis-mercedes/', '/based-on-mercedes/');
          urlEn = urlEn.replace('/auf-basis-porsche/', '/based-on-porsche/');
          urlEn = urlEn.replace('/auf-basis-rolls-royce/', '/based-on-rolls-royce/');
          urlEn = urlEn.replace('/uebersicht/', '/overview/');
          urlEn = urlEn.replace('/artikel/', '/article/');
          
          const htmlEn = await fetchPage(urlEn);
          if (!htmlEn) { console.log('404 EN URL:', urlEn);
            processed++;
            return null;
          }

          // Extract Price from DE, Titles/Desc from EN
          const product = extractProductData(htmlDe, htmlEn, urlDe);
          
          // KEEP ALL PRODUCTS with title, even if price is 0 (Preis auf Anfrage)
          if (product.title) {
            allProducts.push(product);
          }
        } catch (err) {
            console.error(urlDe, err.message);
        }
        processed++;
        if (processed % 50 === 0) {
            process.stdout.write(`\r✅ Processed ${processed}/${targetUrls.length} items... Extracted: ${allProducts.length}`);
        }
      })
    );

    await Promise.all(promises);

    console.log(`\n\n📊 Results:`);
    console.log(`   Scraped successfully: ${allProducts.length} of ${targetUrls.length}`);
    
    // Write CSV
    const csv = productsToShopifyCsv(allProducts);
    fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8');
    console.log(`\n💾 CSV: ${OUTPUT_CSV}`);

    // Write JSON
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(allProducts, null, 2), 'utf-8');
    console.log(`   JSON: ${OUTPUT_JSON}`);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
