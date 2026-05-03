import { chromium } from 'playwright';

const shortcode = 'DW3qRqdDO4l'; // 10 photos! Liberty Walk

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://saveig.app/en/instagram-carousel-downloader');
  
  await page.fill('#q', `https://www.instagram.com/p/${shortcode}/`);
  await page.click('.btn-custom');
  
  try {
    await page.waitForSelector('.download-items', { timeout: 15000 });
    const links = await page.$$eval('.download-items a[href]', els => els.map(a => a.href));
    console.log(`Links for ${shortcode}:`, links.length);
    console.log(links);
  } catch (e) {
    console.log('Failed to get links:', e);
  }
  
  await browser.close();
}

main().catch(console.error);
