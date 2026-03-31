/**
 * DO88 Image URL Fixer
 * 
 * Scrapes current product pages from do88.se to find updated image URLs,
 * since the old URLs (bilder/artiklar/stor/...) now return 404.
 * 
 * Approach: For each DO88 product in the DB, construct the product page URL
 * from the SKU, fetch it, and extract the current image URL.
 */

import https from 'https';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'https://www.do88.se';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${BASE_URL}${res.headers.location}`;
        return fetchPage(loc).then(resolve).catch(reject);
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

function extractImageUrl(html, sku) {
  // Try multiple extraction strategies
  
  // Strategy 1: Look for og:image meta tag
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (ogMatch) return ogMatch[1].startsWith('http') ? ogMatch[1] : `${BASE_URL}${ogMatch[1]}`;

  // Strategy 2: Look for main product image in structured data
  const ldMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (ldMatch && ldMatch[1].includes('bilder')) {
    return ldMatch[1].startsWith('http') ? ldMatch[1] : `${BASE_URL}${ldMatch[1]}`;
  }

  // Strategy 3: Look for product image in img tags
  const imgRegex = new RegExp(`src="([^"]*(?:bilder|images|img)[^"]*${sku}[^"]*)"`, 'i');
  const imgMatch = html.match(imgRegex);
  if (imgMatch) return imgMatch[1].startsWith('http') ? imgMatch[1] : `${BASE_URL}${imgMatch[1]}`;

  // Strategy 4: Any image in bilder/artiklar
  const bilderMatch = html.match(/src="([^"]*bilder\/artiklar[^"]+)"/i);
  if (bilderMatch) return bilderMatch[1].startsWith('http') ? bilderMatch[1] : `${BASE_URL}${bilderMatch[1]}`;

  // Strategy 5: Look for image in picture/source tags
  const srcsetMatch = html.match(/srcset="([^"]*bilder[^"]*)"/) 
    || html.match(/data-src="([^"]*bilder[^"]*)"/);
  if (srcsetMatch) {
    const src = srcsetMatch[1].split(',')[0].trim().split(' ')[0];
    return src.startsWith('http') ? src : `${BASE_URL}${src}`;
  }

  return null;
}

async function main() {
  console.log('🔧 DO88 Image URL Fixer');
  console.log('========================\n');

  // First, test with a single product to understand the URL structure
  console.log('🧪 Testing URL patterns...');
  
  const testSkus = ['ICM-110', 'WRC-330', 'R95-114'];
  for (const sku of testSkus) {
    const skuLower = sku.toLowerCase();
    // Try different URL patterns
    const patterns = [
      `${BASE_URL}/en/artiklar/${skuLower}.html`,
      `${BASE_URL}/en/articles/${skuLower}.html`,
      `${BASE_URL}/sv/artiklar/${skuLower}.html`,
    ];
    
    for (const url of patterns) {
      try {
        const html = await fetchPage(url);
        const imgUrl = extractImageUrl(html, sku);
        console.log(`  ✅ ${url}`);
        console.log(`     Image: ${imgUrl || 'NOT FOUND'}`);
        
        if (imgUrl) {
          // Verify it returns 200
          try {
            const headRes = await new Promise((resolve, reject) => {
              const req = https.request(imgUrl, { method: 'HEAD' }, (res) => {
                resolve(res.statusCode);
              });
              req.on('error', reject);
              req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
              req.end();
            });
            console.log(`     Status: ${headRes}`);
          } catch (e) {
            console.log(`     Verify failed: ${e.message}`);
          }
        }
        break; // If we found a working URL pattern, stop trying others
      } catch (e) {
        console.log(`  ❌ ${url} → ${e.message}`);
      }
    }
    console.log('');
  }
}

main().finally(() => prisma.$disconnect());
