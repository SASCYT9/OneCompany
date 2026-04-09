import { chromium } from 'playwright';

const shortcode = 'DW3qRqdDO4l';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://snapinsta.app/en1'); // they sometimes use different routes
  
  await page.fill('#url', `https://www.instagram.com/p/${shortcode}/`);
  await page.click('#btn-submit');
  
  try {
    await page.waitForSelector('.download-content', { timeout: 15000 });
    const links = await page.$$eval('.download-bottom a[href]', els => els.map(a => a.href));
    console.log(`Links for ${shortcode}:`, links.length);
    console.log(links);
  } catch (e) {
    console.log('Failed to get links:', e);
  }
  
  await browser.close();
}

main().catch(console.error);
