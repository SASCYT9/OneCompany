const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join('d:', 'OneCompany', 'wiki', 'screenshots');
const BASE_URL = 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();

  try {
    // Login
    console.log('Logging in...');
    await page.goto(BASE_URL + '/admin', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"], input[name*="email"]').first().fill('admin@onecompany.local');
    await page.locator('input[type="password"]').first().fill('OCAdmin-6RrB8p6dDCOeNH3FQAys4PNB-2026');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);

    // CRM with longer timeout
    console.log('-> CRM');
    await page.goto(BASE_URL + '/admin/crm', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_crm.png'), fullPage: false });
    console.log('OK: 11_crm.png');

    // Storefront pages
    console.log('-> Storefront shop page');
    await page.goto(BASE_URL + '/uk/shop', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12_storefront.png'), fullPage: false });
    console.log('OK: 12_storefront.png');

    // Akrapovic storefront
    console.log('-> Akrapovic storefront');
    await page.goto(BASE_URL + '/uk/shop/akrapovic', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_akrapovic.png'), fullPage: false });
    console.log('OK: 13_akrapovic.png');

    // Urban store
    console.log('-> Urban storefront');
    await page.goto(BASE_URL + '/uk/shop/urban', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14_urban.png'), fullPage: false });
    console.log('OK: 14_urban.png');

    console.log('\nDONE');
  } catch (error) {
    console.error('ERROR:', error.message);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error2.png'), fullPage: false });
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
