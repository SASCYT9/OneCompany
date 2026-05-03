import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  console.log('🚀 Launching Chrome to find new posts...');
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  
  await page.goto('https://www.instagram.com/onecompany.global/', { waitUntil: 'networkidle' });
  
  const needsLogin = await page.$('input[name="username"]');
  if (needsLogin) {
    console.log('\n⚠️ PLEASE LOG IN! You have 60 seconds...');
    try {
      await page.waitForNavigation({ timeout: 60000 });
    } catch(e) {}
  }
  
  console.log('Scanning profile for posts...');
  await page.waitForTimeout(5000);
  
  // scroll down a bit
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(2000);
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/p/"]')).map(a => a.href);
  });
  
  const shortcodes = [...new Set(links.map(l => {
    const parts = l.split('/p/');
    if (parts.length > 1) {
      return parts[1].replace(/\//g, '');
    }
    return null;
  }).filter(Boolean))];
  
  console.log('Found shortcodes:', shortcodes);
  fs.writeFileSync('scripts/tmp-shortcodes.json', JSON.stringify(shortcodes));
  
  await browser.close();
}

main().catch(console.error);
