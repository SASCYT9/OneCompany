#!/usr/bin/env node
/**
 * Scrape Instagram posts from @onecompany.global
 * Uses Playwright with real Chromium to bypass Instagram's JS-rendered content.
 * Connects to user's Chrome profile for authentication.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const PROFILE_URL = 'https://www.instagram.com/onecompany.global/';
const OUTPUT_DIR = path.resolve('public/images/blog');
const DATA_FILE = path.resolve('scripts/ig-scraped-posts.json');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url.substring(0, 80)}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlinkSync(dest); reject(err); });
    }).on('error', (err) => { fs.unlinkSync(dest); reject(err); });
  });
}

async function main() {
  console.log('🚀 Launching browser (will use your Chrome login)...');
  
  // Launch with persistent context to use existing Chrome profile cookies
  // Or launch headful so user can log in if needed
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome', // Use installed Chrome
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  
  console.log('📱 Opening Instagram profile...');
  await page.goto(PROFILE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  
  // Check if we need to log in
  const needsLogin = await page.$('input[name="username"]');
  if (needsLogin) {
    console.log('\n⚠️  Instagram requires login!');
    console.log('👉 Please log in manually in the browser window that opened.');
    console.log('   Waiting for the profile page to load after login...\n');
    
    // Wait for the user to log in and navigate to the profile
    await page.waitForURL('**/onecompany.global/**', { timeout: 300000 }); // 5 min
    await page.waitForTimeout(3000);
  }
  
  // Wait for posts grid to appear - try multiple selectors
  console.log('⏳ Waiting for posts to load...');
  try {
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 30000 });
  } catch {
    console.log('⚠️ Standard selector failed, waiting more...');
    await page.waitForTimeout(5000);
  }
  
  // Debug: dump all links to see what's on page
  const allLinks = await page.$$eval('a[href]', links => 
    links.map(a => a.href).filter(h => h.includes('/p/') || h.includes('/reel/'))
  );
  console.log(`🔍 Debug: found ${allLinks.length} post/reel links on page`);
  if (allLinks.length === 0) {
    // Try to find any content structure
    const bodyHTML = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return main.innerHTML.substring(0, 3000);
    });
    console.log('📄 Page structure preview:', bodyHTML.substring(0, 1000));
    
    // Maybe we hit a login wall or cookie banner
    // Try dismissing cookie/login overlays
    const dismissBtns = await page.$$('button');
    for (const btn of dismissBtns) {
      const text = await btn.textContent().catch(() => '');
      if (text.match(/accept|allow|dismiss|not now|close|decline|log in/i)) {
        console.log(`   Clicking: "${text.trim()}"`);
      }
    }
    
    // Take a debug screenshot
    await page.screenshot({ path: 'debug-instagram.png', fullPage: false });
    console.log('📸 Debug screenshot saved to debug-instagram.png');
  }
  
  // Scroll down to load more posts
  console.log('📜 Scrolling to load all posts...');
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2500);
  }
  
  // Collect all post links — try broad selector
  const postLinks = await page.$$eval('a[href]', (links) =>
    [...new Set(links.map((a) => a.href))].filter(h => h.includes('/p/') || h.includes('/reel/'))
  );
  
  console.log(`\n📸 Found ${postLinks.length} posts. Scraping each one...\n`);
  
  const posts = [];
  
  for (let i = 0; i < postLinks.length; i++) {
    const postUrl = postLinks[i];
    const shortcode = postUrl.match(/\/p\/([^/]+)/)?.[1] || `post-${i}`;
    
    console.log(`[${i + 1}/${postLinks.length}] Scraping ${shortcode}...`);
    
    try {
      await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      
      // Get post images - try multiple selectors
      let imageUrls = await page.$$eval(
        'article img[src*="scontent"], article img[srcset], div[role="presentation"] img, article img[crossorigin]',
        (imgs) => imgs
          .map((img) => img.src || img.srcset?.split(',')[0]?.trim()?.split(' ')[0])
          .filter((src) => src && src.includes('scontent') && !src.includes('s150x150') && !src.includes('s100x100'))
      );
      
      // Deduplicate
      imageUrls = [...new Set(imageUrls)];
      
      // If carousel, try to get more images by clicking arrows
      const nextBtn = await page.$('button[aria-label="Next"], button[aria-label="Далі"], div._aahi');
      if (nextBtn) {
        for (let slide = 0; slide < 10; slide++) {
          try {
            const btn = await page.$('button[aria-label="Next"], button[aria-label="Далі"], button._aahi');
            if (!btn) break;
            await btn.click();
            await page.waitForTimeout(800);
            
            const newUrls = await page.$$eval(
              'article img[src*="scontent"], div[role="presentation"] img, article img[crossorigin]',
              (imgs) => imgs
                .map((img) => img.src)
                .filter((src) => src && src.includes('scontent') && !src.includes('s150x150'))
            );
            newUrls.forEach(u => { if (!imageUrls.includes(u)) imageUrls.push(u); });
          } catch { break; }
        }
      }
      
      // Get caption text
      const caption = await page.evaluate(() => {
        // Try multiple selectors for caption
        const selectors = [
          'div._a9zs span._ap3a',
          'div._a9zs',
          'h1._ap3a',
          'span[dir="auto"]',
          'article span[dir="auto"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent && el.textContent.length > 20) {
            return el.textContent.trim();
          }
        }
        // Fallback: get the longest text in article
        const spans = document.querySelectorAll('article span');
        let longest = '';
        spans.forEach(s => { if (s.textContent.length > longest.length) longest = s.textContent; });
        return longest.trim();
      });
      
      // Get post date
      const dateStr = await page.evaluate(() => {
        const time = document.querySelector('time[datetime]');
        return time ? time.getAttribute('datetime') : null;
      });
      
      // Get likes count
      const likes = await page.evaluate(() => {
        const likesEl = document.querySelector('span.x1lliihq a span span') ||
                        document.querySelector('section span[class*="html"]');
        return likesEl ? likesEl.textContent : null;
      });
      
      // Download images
      const savedImages = [];
      for (let j = 0; j < imageUrls.length; j++) {
        const imgUrl = imageUrls[j].replace(/&amp;/g, '&');
        const ext = imgUrl.includes('.webp') ? 'webp' : 'jpg';
        const filename = `${shortcode}${imageUrls.length > 1 ? `-${j + 1}` : ''}.${ext}`;
        const destPath = path.join(OUTPUT_DIR, filename);
        
        try {
          await downloadFile(imgUrl, destPath);
          const stat = fs.statSync(destPath);
          if (stat.size > 1000) { // Valid image
            savedImages.push(`/images/blog/${filename}`);
            console.log(`   ✅ Saved ${filename} (${Math.round(stat.size / 1024)}KB)`);
          } else {
            fs.unlinkSync(destPath);
          }
        } catch (err) {
          console.log(`   ⚠️  Failed to download image ${j + 1}: ${err.message}`);
        }
      }
      
      // If no images downloaded via CDN, take a screenshot of the post
      if (savedImages.length === 0) {
        console.log('   📷 No CDN images, taking screenshot...');
        const postImg = await page.$('article img[crossorigin], article video, div[role="presentation"] img');
        if (postImg) {
          const screenshotPath = path.join(OUTPUT_DIR, `${shortcode}.png`);
          await postImg.screenshot({ path: screenshotPath });
          const stat = fs.statSync(screenshotPath);
          if (stat.size > 1000) {
            savedImages.push(`/images/blog/${shortcode}.png`);
            console.log(`   ✅ Screenshot saved (${Math.round(stat.size / 1024)}KB)`);
          }
        }
      }
      
      posts.push({
        shortcode,
        url: postUrl,
        date: dateStr,
        caption: caption?.substring(0, 2000) || '',
        likes,
        images: savedImages,
        allImageUrls: imageUrls.length,
      });
      
      console.log(`   📝 Caption: ${caption?.substring(0, 80) || 'N/A'}...`);
      console.log(`   🖼️  ${savedImages.length} images saved\n`);
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}\n`);
      posts.push({ shortcode, url: postUrl, error: err.message, images: [] });
    }
  }
  
  // Save results
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
  console.log(`\n✅ Done! Scraped ${posts.length} posts.`);
  console.log(`📁 Images saved to: ${OUTPUT_DIR}`);
  console.log(`📄 Data saved to: ${DATA_FILE}`);
  
  // Summary
  const totalImages = posts.reduce((sum, p) => sum + p.images.length, 0);
  console.log(`\n📊 Summary: ${posts.length} posts, ${totalImages} images downloaded`);
  
  await browser.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
