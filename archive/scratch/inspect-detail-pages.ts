import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { isUrbanPlaceholderImage } from '../../src/lib/urbanImageUtils';

function isActuallyPlaceholder(url: string): boolean {
  try {
    // If the url is a full URL, extract only the pathname to avoid matching the domain "gp-portal.eu" or "gpproducts"
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    
    // We want to keep gp-portal and gpproducts markers for filenames (like logos) but ignore for domain name.
    // isUrbanPlaceholderImage expects normalized url, so we pass pathname.
    return isUrbanPlaceholderImage(pathname);
  } catch {
    return isUrbanPlaceholderImage(url);
  }
}

async function fetchGalleryFromProductPage(productHandle: string): Promise<string[]> {
  const url = `https://gp-portal.eu/products/${productHandle}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      console.error(`  [Fetch ERROR] HTTP ${response.status} for ${url}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const rawImages: string[] = [];

    // Extract all image tags
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset') || '';
      if (src) {
        const urls = src.split(',').map(s => s.trim().split(' ')[0]);
        for (let cleanUrl of urls) {
          if (!cleanUrl) continue;
          cleanUrl = cleanUrl.split('&width=')[0].split('&amp;width=')[0].split('?width=')[0].split('?v=')[0];
          if (cleanUrl.startsWith('//')) {
            cleanUrl = 'https:' + cleanUrl;
          }
          if (cleanUrl.includes('cdn.shopify.com') || cleanUrl.includes('gp-portal.eu')) {
            rawImages.push(cleanUrl);
          }
        }
      }
    });

    // Regex for gp-portal.eu/cdn
    const regex = /\/\/gp-portal\.eu\/cdn\/shop\/files\/[^"\s?]+/g;
    const matches = [...html.matchAll(regex)];
    for (const m of matches) {
      let cleanUrl = m[0];
      cleanUrl = cleanUrl.split('&width=')[0].split('&amp;width=')[0].split('?width=')[0].split('?v=')[0];
      if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
      }
      rawImages.push(cleanUrl);
    }

    // Regex for cdn.shopify.com
    const shopifyRegex = /\/\/cdn\.shopify\.com\/s\/files\/[^"\s?]+/g;
    const shopifyMatches = [...html.matchAll(shopifyRegex)];
    for (const m of shopifyMatches) {
      let cleanUrl = m[0];
      cleanUrl = cleanUrl.split('&width=')[0].split('&amp;width=')[0].split('?width=')[0].split('?v=')[0];
      if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
      }
      rawImages.push(cleanUrl);
    }

    const uniqueRaw = [...new Set(rawImages)];
    const validImages = uniqueRaw.filter(url => !isActuallyPlaceholder(url));

    return validImages;
  } catch (err: any) {
    console.error(`  [Fetch ERROR] ${err.message}`);
    return [];
  }
}

async function main() {
  const gpVariantsPath = path.resolve(process.cwd(), 'archive', 'scratch', 'gp-portal-variants.json');
  const gpVariants = JSON.parse(fs.readFileSync(gpVariantsPath, 'utf8'));

  console.log(`Analyzing ${gpVariants.length} products with corrected placeholder check...`);
  const results: any[] = [];

  for (const item of gpVariants) {
    const sku = item.sku;
    const urlPath = item.product.url;
    const handleMatch = urlPath.match(/\/products\/([^?#]+)/);
    if (!handleMatch) continue;
    const handle = handleMatch[1];

    console.log(`\nAnalyzing ${sku} (${item.product.title})`);
    const images = await fetchGalleryFromProductPage(handle);
    console.log(`Found ${images.length} valid images:`);
    images.forEach(img => console.log(`  - ${img}`));

    results.push({
      sku,
      title: item.product.title,
      handle,
      imagesCount: images.length,
      images
    });
  }

  fs.writeFileSync(
    path.resolve(process.cwd(), 'archive', 'scratch', 'gp-portal-detail-images.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log(`\nSaved results to gp-portal-detail-images.json`);
}

main().catch(console.error);
