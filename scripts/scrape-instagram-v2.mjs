#!/usr/bin/env node
/**
 * Scrape Instagram posts v2 - intercepts network requests for reliable image capture
 * and uses better caption extraction
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';

const OUTPUT_DIR = path.resolve('public/images/blog');
const DATA_FILE = path.resolve('scripts/ig-scraped-posts-v2.json');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Only scrape posts that are missing images or all posts that have /p/ URLs
const POSTS_TO_SCRAPE = [
  'DTsKmdmjFgF',  // OneCompany Premium
  'DUGFrvdDCzP',  // Brabus
  'DT-XLbLjQEb',  // iPE Exhaust
  'DT0NWC8DCsl',  // Eventuri
  'DTu98JODL1s',  // Akrapovic
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = https;
    const parsedUrl = new URL(url);
    client.get({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.instagram.com/',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

async function scrapePost(page, shortcode) {
  const postUrl = `https://www.instagram.com/p/${shortcode}/`;
  console.log(`\n📸 Scraping ${shortcode}...`);
  
  // Collect image URLs from network requests
  const networkImages = new Set();
  
  const handler = (response) => {
    const url = response.url();
    if (url.includes('scontent') && (url.includes('.jpg') || url.includes('.webp') || url.includes('.png')) 
        && !url.includes('s150x150') && !url.includes('s100x100') && !url.includes('s320x320')
        && !url.includes('profile_pic')) {
      networkImages.add(url.split('?')[0] + '?' + url.split('?')[1]); // Keep full URL
    }
  };
  
  page.on('response', handler);
  
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Try to get images from the DOM as well
  let domImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs)
      .map(img => ({ src: img.src, w: img.naturalWidth, h: img.naturalHeight, alt: img.alt }))
      .filter(i => i.src && i.src.includes('scontent') && !i.src.includes('s150x150') 
        && !i.src.includes('s100x100') && !i.src.includes('profile_pic')
        && (i.w > 200 || i.h > 200 || i.w === 0));
  });
  
  console.log(`   🌐 Network images: ${networkImages.size}, DOM images: ${domImages.length}`);
  
  // If it's a carousel, click through slides
  let hasNext = true;
  let clickCount = 0;
  while (hasNext && clickCount < 15) {
    try {
      // Try various next button selectors
      const nextBtn = await page.$('[aria-label="Next"], [aria-label="Далі"], button._aahi, div._aahi button');
      if (!nextBtn) { hasNext = false; break; }
      
      const isVisible = await nextBtn.isVisible();
      if (!isVisible) { hasNext = false; break; }
      
      await nextBtn.click();
      clickCount++;
      await page.waitForTimeout(1200);
      
      // Get new images from DOM after click
      const newDomImgs = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        return Array.from(imgs)
          .map(img => img.src)
          .filter(src => src && src.includes('scontent') && !src.includes('s150x150') 
            && !src.includes('s100x100') && !src.includes('profile_pic'));
      });
      newDomImgs.forEach(u => networkImages.add(u));
      
    } catch { hasNext = false; }
  }
  
  if (clickCount > 0) console.log(`   🔄 Clicked through ${clickCount} carousel slides`);
  
  // Get caption - try multiple approaches
  const caption = await page.evaluate(() => {
    // Method 1: Look for the main caption container
    const captionSelectors = [
      'div._a9zs span._ap3a span',
      'div._a9zs span._ap3a',  
      'div._a9zs h1',
      'div._a9zs span',
      'h1._ap3a span',
      'h1._ap3a',
    ];
    
    for (const sel of captionSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.length > 10) {
        return el.innerText.trim();
      }
    }
    
    // Method 2: look for spans with Ukrainian text or hashtags
    const allSpans = document.querySelectorAll('span[dir="auto"], span');
    let best = '';
    for (const span of allSpans) {
      const text = span.innerText || '';
      if (text.length > best.length && text.length > 20 && 
          (text.includes('#') || text.includes('🔥') || text.includes('✅') || 
           /[а-яіїєґ]/i.test(text))) {
        best = text;
      }
    }
    if (best) return best.trim();
    
    // Method 3: meta description
    const meta = document.querySelector('meta[name="description"]');
    if (meta) return meta.content;
    
    return '';
  });
  
  // Get date
  const dateStr = await page.evaluate(() => {
    const time = document.querySelector('time[datetime]');
    return time ? time.getAttribute('datetime') : null;
  });
  
  page.off('response', handler);
  
  // Merge network + DOM images, deduplicate by base URL
  const allUrls = [...networkImages];
  domImages.forEach(d => {
    if (!allUrls.some(u => u.includes(d.src.split('?')[0].split('/').pop()))) {
      allUrls.push(d.src);
    }
  });
  
  // Filter to only actual post images (not tiny thumbs, not profile pics)
  const filteredUrls = allUrls.filter(u => {
    const path = new URL(u).pathname;
    return !path.includes('s150x150') && !path.includes('s100x100') && !path.includes('s320x320')
      && !path.includes('profile_pic');
  });
  
  // Deduplicate by filename
  const seen = new Set();
  const uniqueUrls = filteredUrls.filter(u => {
    const fname = new URL(u).pathname.split('/').pop();
    if (seen.has(fname)) return false;
    seen.add(fname);
    return true;
  });
  
  console.log(`   📷 Total unique images to download: ${uniqueUrls.length}`);
  if (caption) console.log(`   📝 Caption: ${caption.substring(0, 100)}...`);
  
  // Download images
  const savedImages = [];
  for (let j = 0; j < uniqueUrls.length; j++) {
    const imgUrl = uniqueUrls[j].replace(/&amp;/g, '&');
    const ext = 'jpg';
    const filename = `${shortcode}${uniqueUrls.length > 1 ? `-${j + 1}` : ''}.${ext}`;
    const destPath = path.join(OUTPUT_DIR, filename);
    
    // Skip if already exists and has good size
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 5000) {
      savedImages.push(`/images/blog/${filename}`);
      console.log(`   ⏭️  Already exists: ${filename}`);
      continue;
    }
    
    try {
      await downloadFile(imgUrl, destPath);
      const stat = fs.statSync(destPath);
      if (stat.size > 5000) {
        savedImages.push(`/images/blog/${filename}`);
        console.log(`   ✅ Saved ${filename} (${Math.round(stat.size / 1024)}KB)`);
      } else {
        fs.unlinkSync(destPath);
        console.log(`   ⚠️  Too small, skipped`);
      }
    } catch (err) {
      console.log(`   ❌ Download failed: ${err.message}`);
    }
  }
  
  // If still no images, take a screenshot of the main image element
  if (savedImages.length === 0) {
    console.log('   📸 Fallback: taking element screenshot...');
    try {
      // Go back to the post
      await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Find the main media element
      const mediaEl = await page.$('article div[role="button"] img, article img[style*="object-fit"], div._aagv img, article img[crossorigin]');
      if (mediaEl) {
        const ssPath = path.join(OUTPUT_DIR, `${shortcode}.jpg`);
        await mediaEl.screenshot({ path: ssPath, type: 'jpeg', quality: 90 });
        const stat = fs.statSync(ssPath);
        if (stat.size > 3000) {
          savedImages.push(`/images/blog/${shortcode}.jpg`);
          console.log(`   ✅ Screenshot saved (${Math.round(stat.size / 1024)}KB)`);
        }
      } else {
        console.log(`   ⚠️  No media element found for screenshot`);
      }
    } catch (err) {
      console.log(`   ❌ Screenshot failed: ${err.message}`);
    }
  }
  
  return {
    shortcode,
    url: postUrl,
    date: dateStr,
    caption: caption?.substring(0, 3000) || '',
    images: savedImages,
  };
}

async function main() {
  console.log('🚀 Launching Chrome...');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  
  // First, navigate to Instagram to check login status
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 30000 });
  const needsLogin = await page.$('input[name="username"]');
  if (needsLogin) {
    console.log('\n⚠️  Please log in to Instagram in the browser window!');
    console.log('   Waiting up to 5 minutes...\n');
    await page.waitForSelector('svg[aria-label="Home"], svg[aria-label="Головна"]', { timeout: 300000 });
    await page.waitForTimeout(2000);
  }
  
  console.log(`\n📋 Scraping ${POSTS_TO_SCRAPE.length} posts that are missing images...\n`);
  
  const results = [];
  for (const shortcode of POSTS_TO_SCRAPE) {
    const result = await scrapePost(page, shortcode);
    results.push(result);
  }
  
  // Load existing data and merge
  let existingData = [];
  try {
    existingData = JSON.parse(fs.readFileSync(path.resolve('scripts/ig-scraped-posts.json'), 'utf8'));
  } catch {}
  
  // Merge: update posts that we re-scraped
  for (const result of results) {
    const existing = existingData.find(p => p.shortcode === result.shortcode);
    if (existing) {
      if (result.images.length > 0) existing.images = result.images;
      if (result.caption) existing.caption = result.caption;
      existing.allImageUrls = result.images.length;
    }
  }
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2));
  fs.writeFileSync(path.resolve('scripts/ig-scraped-posts.json'), JSON.stringify(existingData, null, 2));
  
  const totalNew = results.reduce((sum, p) => sum + p.images.length, 0);
  console.log(`\n✅ Done! Got ${totalNew} new images from ${POSTS_TO_SCRAPE.length} posts`);
  
  await browser.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
