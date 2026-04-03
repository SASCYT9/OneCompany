const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIR = path.join('d:', 'OneCompany', 'wiki', 'screenshots');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('file:///D:/OneCompany/wiki/One Company Platform — Investor Presentation.html');
  await page.waitForTimeout(2000);

  const slides = [
    { y: 0, name: 'pres_01_hero.png' },
    { y: 1100, name: 'pres_02_arch.png' },
    { y: 2200, name: 'pres_03_crm.png' },
    { y: 3300, name: 'pres_04_catalog.png' },
    { y: 4400, name: 'pres_05_orders.png' },
    { y: 5500, name: 'pres_06_customers.png' },
    { y: 6600, name: 'pres_07_import.png' },
    { y: 7700, name: 'pres_08_integrations.png' },
    { y: 8800, name: 'pres_09_settings.png' },
    { y: 9900, name: 'pres_10_logistics.png' },
    { y: 11000, name: 'pres_11_roadmap.png' },
  ];

  for (const s of slides) {
    await page.evaluate(y => window.scrollTo(0, y), s.y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(DIR, s.name) });
    console.log('OK:', s.name);
  }

  // Last slide
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, 'pres_12_summary.png') });
  console.log('OK: pres_12_summary.png');

  await browser.close();
  console.log('DONE');
}

run().catch(console.error);
