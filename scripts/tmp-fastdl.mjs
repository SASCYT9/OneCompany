import { chromium } from 'playwright';

const shortcodes = ['DWn0fWMjB1t'];

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://fastdl.app/en');
  await page.fill('#search-form-input', `https://www.instagram.com/p/${shortcodes[0]}/`);
  await page.click('.search-form__button');
  
  try {
    await page.waitForSelector('.output-list__item', { timeout: 15000 });
    const links = await page.$$eval('.output-list__item a.button[href]', els => els.map(a => a.href));
    console.log(`Extracted links for ${shortcodes[0]}:`, links);
  } catch (e) {
    console.log('Failed:', e);
  }
  
  await browser.close();
}

main().catch(console.error);
