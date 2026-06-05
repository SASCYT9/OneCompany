import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to determine if the image is a generic vehicle placeholder silhouette
function isActuallyPlaceholder(url: string): boolean {
  const norm = url.toLowerCase();
  
  if (
    norm.includes('l460') || 
    norm.includes('l461') || 
    norm.includes('l494') || 
    norm.includes('transporter') || 
    norm.includes('gwagon') ||
    norm.includes('cullinan') ||
    norm.includes('defender') ||
    norm.includes('urus')
  ) {
    if (/\/(transporter|gwagon|l460|l461|l494|cullinan|defender|urus)(_[a-z0-9\-]+)?\.png$/i.test(norm.split('?')[0])) {
      return true;
    }
  }

  if (
    [
      'coming-soon',
      'comingsoon',
      'placeholder',
      'no-image',
      'image-coming-soon',
      'image_coming_soon',
      'favicon'
    ].some(marker => norm.includes(marker))
  ) {
    return true;
  }

  return false;
}

// Check for tires closeups
function isTireImageOnly(url: string): boolean {
  const norm = url.toLowerCase();
  return norm.includes('pirelli') || norm.includes('continental') || norm.includes('sportcontact') || norm.includes('scorpion');
}

async function fetchGalleryFromProductPage(productHandle: string): Promise<string[]> {
  const url = `https://gp-portal.eu/products/${productHandle}`;
  console.log(`  [Fetch] Fetching ${productHandle}...`);
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

    // Regex search
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

    const uniqueRaw = [...new Set(rawImages)];
    const validImages = uniqueRaw.filter(url => !isActuallyPlaceholder(url));
    const finalGpImages = validImages.filter(url => !isTireImageOnly(url));

    return finalGpImages;
  } catch (err: any) {
    console.error(`  [Fetch ERROR] ${err.message}`);
    return [];
  }
}

async function main() {
  const htmlPath = path.resolve(process.cwd(), 'archive', 'scratch', 'gp-portal-L460-raw.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('gp-portal-L460-raw.html not found! Run fetch-gp-portal-l460.ts first.');
    return;
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  
  // Extract all product links starting with /products/
  // Match "/products/urb-" or similar inside the page
  const productRegex = /\/products\/[a-z0-9\-]+/gi;
  const matches = [...html.matchAll(productRegex)];
  const uniqueHandles = [...new Set(matches.map(m => m[0].split('/products/')[1].split('?')[0].toLowerCase()))];

  console.log(`Found ${uniqueHandles.length} unique handles in L460 search results.`);

  // Load database products
  const dbProducts = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { sku: { startsWith: 'URB-' } },
        { slug: { startsWith: 'urb-' } }
      ]
    },
    select: {
      id: true,
      sku: true,
      slug: true,
      titleEn: true,
      image: true,
      gallery: true
    }
  });

  const results: any[] = [];
  let output = `Analyzing L460 Urban Products from GP Portal...\n\n`;

  for (const handle of uniqueHandles) {
    // Only process handles that correspond to L460 (e.g. contain l460 or similar, but let's compare with DB)
    const dbProduct = dbProducts.find((p: any) => {
      const cleanDbSku = p.sku.replace(/-V\d+$/i, '').toLowerCase();
      // Handle might contain SKU (e.g. urb-bod-25353001-v1)
      const cleanHandle = handle.replace(/-V\d+$/i, '').toLowerCase();
      return p.slug.toLowerCase() === handle || cleanDbSku === cleanHandle || handle.includes(p.sku.toLowerCase());
    });

    if (!dbProduct) {
      // Skipping products not in database (or L461 products that matched L460 query)
      continue;
    }

    // Ignore L461 products since we already did L461
    if (dbProduct.sku.toLowerCase().includes('l461') || dbProduct.slug.toLowerCase().includes('l461') || dbProduct.titleEn.toLowerCase().includes('l461')) {
      continue;
    }

    output += `==================================================\n`;
    output += `GP Product Handle: ${handle}\n`;
    output += `DB Product SKU: ${dbProduct.sku}\n`;
    output += `DB Product Title: ${dbProduct.titleEn}\n`;
    output += `DB Product Image: ${dbProduct.image}\n`;
    output += `DB Product Gallery: ${JSON.stringify(dbProduct.gallery)}\n`;

    const gpImages = await fetchGalleryFromProductPage(handle);
    output += `Found ${gpImages.length} valid images on GP Portal:\n`;
    gpImages.forEach(img => output += `  - ${img}\n`);

    let action = '';
    if (gpImages.length === 0) {
      action = 'KEEP DB IMAGES (GP Portal has no valid product photos)';
    } else {
      const hasBlob = dbProduct.image?.includes('vercel-storage.com');
      if (hasBlob) {
        action = 'ALREADY MIGRATED TO BLOB';
      } else {
        // Compare with current image
        const isCurrentlyLocalPlaceholder = dbProduct.image?.includes('/urus-se/') || dbProduct.image?.includes('/fallback/');
        if (isCurrentlyLocalPlaceholder) {
          action = `MIGRATE TO BLOB (We have placeholder/local mockup, but GP has ${gpImages.length} real photos!)`;
        } else {
          action = `SYNC IMAGES (We have images, GP has ${gpImages.length} images. Check if we need to sync.)`;
        }
      }
    }
    output += `=> RECOMMENDATION: ${action}\n`;

    results.push({
      handle,
      sku: dbProduct.sku,
      title: dbProduct.titleEn,
      gpImages,
      dbImage: dbProduct.image,
      dbGallery: dbProduct.gallery,
      recommendation: action
    });
  }

  fs.writeFileSync(path.resolve(process.cwd(), 'archive', 'scratch', 'gp-portal-l460-comparison.txt'), output, 'utf8');
  fs.writeFileSync(
    path.resolve(process.cwd(), 'archive', 'scratch', 'gp-portal-l460-comparison.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('Saved comparison results to gp-portal-l460-comparison.txt and .json');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
