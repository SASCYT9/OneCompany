import { chromium } from 'playwright';
import fs from 'fs';
import https from 'https';
import path from 'path';

const shortcode = 'DWvkRABDKnw';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://fastdl.app/en');
  await page.fill('#search-form-input', `https://www.instagram.com/p/${shortcode}/`);
  await page.click('.search-form__button');
  
  let link = null;
  try {
    await page.waitForSelector('.output-list__item a.button[href]', { timeout: 15000 });
    link = await page.$eval('.output-list__item a.button[href]', a => a.href);
    console.log(`Extracted video link: ${link}`);
  } catch (e) {
    console.log('Failed:', e);
  }
  
  await browser.close();
}

main().catch(console.error);
