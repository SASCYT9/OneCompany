#!/usr/bin/env node
/**
 * Scrape specific missing posts by taking element screenshots
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.resolve('public/images/blog');
const POSTS = ['DTsKmdmjFgF', 'DUGFrvdDCzP', 'DUImF4bjCgv']; // missing + get first image for DUImF4bjCgv

async function main() {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const shortcode of POSTS) {
    const url = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`\n📸 ${shortcode}: opening ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find the main post image - try multiple selectors  
    const selectors = [
      'article div[role="presentation"] img',
      'article img[crossorigin]',
      'article div[role="button"] img',
      'div._aagv img',
      'img[style*="object-fit"]',
    ];
    
    let mainImg = null;
    for (const sel of selectors) {
      const imgs = await page.$$(sel);
      for (const img of imgs) {
        const src = await img.getAttribute('src');
        if (src && src.includes('scontent') && !src.includes('s150x150') && !src.includes('s100x100') && !src.includes('profile_pic')) {
          const box = await img.boundingBox();
          if (box && box.width > 200 && box.height > 200) {
            mainImg = img;
            console.log(`   Found main image: ${box.width}x${box.height}`);
            break;
          }
        }
      }
      if (mainImg) break;
    }

    if (mainImg) {
      // Take a high quality screenshot of the element
      const ssPath = path.join(OUTPUT_DIR, `${shortcode}-1.jpg`);
      await mainImg.screenshot({ path: ssPath, type: 'jpeg', quality: 95 });
      const stat = fs.statSync(ssPath);
      console.log(`   ✅ Screenshot saved: ${shortcode}-1.jpg (${Math.round(stat.size/1024)}KB)`);
      
      // Try carousel next slides
      let slideNum = 2;
      for (let i = 0; i < 10; i++) {
        const nextBtn = await page.$('button[aria-label="Next"], button[aria-label="Далі"]');
        if (!nextBtn) break;
        const isVis = await nextBtn.isVisible().catch(() => false);
        if (!isVis) break;
        
        await nextBtn.click();
        await page.waitForTimeout(1200);
        
        // Find the current visible image
        let slideImg = null;
        for (const sel of selectors) {
          const imgs = await page.$$(sel);
          for (const img of imgs) {
            const box = await img.boundingBox();
            if (box && box.width > 200 && box.height > 200) {
              slideImg = img;
              break;
            }
          }
          if (slideImg) break;
        }
        
        if (slideImg) {
          const slidePath = path.join(OUTPUT_DIR, `${shortcode}-${slideNum}.jpg`);
          await slideImg.screenshot({ path: slidePath, type: 'jpeg', quality: 95 });
          const stat = fs.statSync(slidePath);
          console.log(`   ✅ Slide ${slideNum}: ${shortcode}-${slideNum}.jpg (${Math.round(stat.size/1024)}KB)`);
          slideNum++;
        }
      }
    } else {
      console.log(`   ⚠️ No main image found`);
      // Full viewport screenshot as fallback
      const ssPath = path.join(OUTPUT_DIR, `${shortcode}-1.jpg`);
      await page.screenshot({ path: ssPath, type: 'jpeg', quality: 90, clip: { x: 100, y: 100, width: 600, height: 600 } });
      console.log(`   📷 Viewport screenshot saved`);
    }
  }

  await browser.close();
  console.log('\n✅ Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
