const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join('d:', 'OneCompany', 'wiki', 'screenshots');

const BASE_URL = 'http://localhost:3000';

const adminPages = [
  { url: '/admin/shop', name: '03_catalog', wait: 3000 },
  { url: '/admin/shop/orders', name: '04_orders', wait: 3000 },
  { url: '/admin/shop/logistics', name: '05_logistics', wait: 3000 },
  { url: '/admin/shop/pricing', name: '06_pricing', wait: 3000 },
  { url: '/admin/shop/import', name: '07_import', wait: 3000 },
  { url: '/admin/shop/turn14', name: '08_turn14', wait: 3000 },
  { url: '/admin/shop/customers', name: '09_customers', wait: 3000 },
  { url: '/admin/shop/settings', name: '10_settings', wait: 3000 },
  { url: '/admin/crm', name: '11_crm', wait: 3000 },
];

async function run() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();

  try {
    // 1. Login page
    console.log('Navigating to login...');
    await page.goto(BASE_URL + '/admin', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_login.png'), fullPage: false });
    console.log('OK: 01_login.png');

    // 2. Login
    console.log('Logging in...');
    await page.locator('input[type="email"], input[name*="email"]').first().fill('admin@onecompany.local');
    await page.locator('input[type="password"]').first().fill('OCAdmin-6RrB8p6dDCOeNH3FQAys4PNB-2026');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);

    // 3. Dashboard
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_dashboard.png'), fullPage: false });
    console.log('OK: 02_dashboard.png');

    // 4. Each section
    for (const p of adminPages) {
      console.log('-> ' + p.url);
      await page.goto(BASE_URL + p.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(p.wait);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, p.name + '.png'), fullPage: false });
      console.log('OK: ' + p.name + '.png');
    }

    console.log('\nDONE - All screenshots saved to ' + SCREENSHOTS_DIR);
  } catch (error) {
    console.error('ERROR:', error.message);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png'), fullPage: false });
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
