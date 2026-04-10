#!/usr/bin/env node
/**
 * GiroDisc Product Scraper
 * 
 * Fetches all GiroDisc products from atomic-shop.ua via Shopify JSON API.
 * No Playwright needed — Shopify exposes a clean JSON endpoint.
 * 
 * Usage: node scripts/scrape-girodisc.mjs
 * Output: data/girodisc-products.json
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://atomic-shop.ua/collections/girodisc/products.json';
const PRODUCTS_PER_PAGE = 50;
const DELAY_MS = 1500; // Be polite to the server

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page) {
  const url = `${BASE_URL}?limit=${PRODUCTS_PER_PAGE}&page=${page}`;
  console.log(`  📡 Fetching page ${page}: ${url}`);
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on page ${page}`);
  }

  const data = await res.json();
  return data.products || [];
}

function classifyProduct(product) {
  const sku = (product.variants?.[0]?.sku || '').toUpperCase();
  const title = (product.title || '').toLowerCase();
  const productType = (product.product_type || '').toLowerCase();

  // SKU-based classification (most reliable)
  if (sku.startsWith('A1-') || sku.startsWith('A2-')) return 'rotors';     // Two-piece rotors
  if (sku.startsWith('D1-') || sku.startsWith('D2-') || sku.startsWith('GD')) return 'rotors'; // Replacement rings are still rotors category
  if (sku.startsWith('GP')) return 'pads';                                   // Brake pads (GP10/GP20/GP30/GP35)
  if (sku.startsWith('HS-')) return 'shields';                              // Heat shields

  // Title/type fallback
  if (productType.includes('колодки') || title.includes('колодки') || title.includes('pad')) return 'pads';
  if (productType.includes('диски') || title.includes('диск') || title.includes('rotor') || title.includes('кільц')) return 'rotors';
  if (title.includes('shield') || title.includes('щит') || title.includes('захист')) return 'shields';
  if (title.includes('hardware') || title.includes('bolt') || title.includes('кріплення')) return 'hardware';

  return 'rotors'; // GiroDisc is primarily rotors
}

function extractProductData(raw) {
  const variant = raw.variants?.[0] || {};
  const image = raw.images?.[0]?.src || null;
  const allImages = (raw.images || []).map((img) => img.src);
  const priceUah = variant.price ? parseFloat(variant.price) : null;
  const comparePrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;

  return {
    sourceId: String(raw.id),
    handle: raw.handle,
    title: raw.title,
    bodyHtml: raw.body_html || '',
    productType: raw.product_type || '',
    vendor: raw.vendor || 'GIRODISC',
    tags: raw.tags || [],
    sku: variant.sku || null,
    priceUah,
    compareAtPriceUah: comparePrice,
    image,
    gallery: allImages,
    available: variant.available ?? true,
    category: classifyProduct(raw),
    publishedAt: raw.published_at,
    createdAt: raw.created_at,
    scrapedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log('🔧 GiroDisc Scraper — atomic-shop.ua (Shopify JSON API)\n');

  const allProducts = [];
  let page = 1;
  let emptyStreak = 0;

  while (true) {
    try {
      const products = await fetchPage(page);

      if (products.length === 0) {
        emptyStreak++;
        if (emptyStreak >= 2) {
          console.log(`  ✅ No more products. Stopping at page ${page}.`);
          break;
        }
        page++;
        await sleep(DELAY_MS);
        continue;
      }

      emptyStreak = 0;
      const extracted = products.map(extractProductData);
      allProducts.push(...extracted);
      console.log(`  ✅ Page ${page}: ${products.length} products (total: ${allProducts.length})`);

      if (products.length < PRODUCTS_PER_PAGE) {
        console.log(`  ✅ Last page reached (${products.length} < ${PRODUCTS_PER_PAGE}).`);
        break;
      }

      page++;
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  ❌ Error on page ${page}: ${err.message}`);
      if (page > 50) break; // Safety limit
      page++;
      await sleep(DELAY_MS * 2);
    }
  }

  // Deduplicate by handle
  const uniqueMap = new Map();
  for (const p of allProducts) {
    if (!uniqueMap.has(p.handle)) {
      uniqueMap.set(p.handle, p);
    }
  }
  const unique = Array.from(uniqueMap.values());

  // Stats
  const categories = {};
  for (const p of unique) {
    categories[p.category] = (categories[p.category] || 0) + 1;
  }

  console.log(`\n📊 Scrape Summary:`);
  console.log(`   Total raw: ${allProducts.length}`);
  console.log(`   Unique:    ${unique.length}`);
  console.log(`   Categories:`);
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`     - ${cat}: ${count}`);
  }

  // Save
  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'girodisc-products.json');
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf8');
  console.log(`\n💾 Saved to ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
