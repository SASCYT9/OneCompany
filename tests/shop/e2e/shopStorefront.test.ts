import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SHOP_E2E_BASE_URL || 'http://127.0.0.1:3001';

test('guest can add product to cart and complete checkout flow', async (t) => {
  if (process.env.SHOP_BROWSER_E2E !== '1') {
    t.skip('Set SHOP_BROWSER_E2E=1 to run browser storefront smoke');
    return;
  }

  const probe = await fetch(`${baseUrl}/en/shop/urban`).catch(() => null);
  if (!probe?.ok) {
    t.skip(`Shop base URL is not reachable at ${baseUrl}`);
    return;
  }

  const productsResponse = await fetch(`${baseUrl}/api/shop/products?collection=range-rover-l460`).catch(
    () => null
  );
  if (!productsResponse?.ok) {
    t.skip('Public products API is not reachable for E2E smoke');
    return;
  }

  const products = (await productsResponse.json()) as Array<{ slug: string }>;
  const product = products[0];
  if (!product?.slug) {
    t.skip('No collection product available for storefront E2E smoke');
    return;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    t.skip(`Playwright browser is not available: ${(error as Error).message}`);
    return;
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}/en/shop/urban/products/${product.slug}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /add to cart/i }).click();
  await page.waitForURL(/\/en\/shop\/cart/);
  await page.getByRole('link', { name: /proceed to checkout/i }).click();
  await page.waitForURL(/\/en\/shop\/checkout/);

  await page.getByPlaceholder('Email').fill(`shop-e2e-${Date.now()}@example.com`);
  await page.getByPlaceholder('Full name').fill('Shop E2E Guest');
  await page.getByPlaceholder('Address (street, number)').fill('1 Test Street');
  await page.getByPlaceholder('City').fill('Berlin');
  await page.getByPlaceholder('Country').fill('Germany');
  await page.getByRole('button', { name: /place order/i }).click();

  await page.waitForURL(/\/en\/shop\/checkout\/success\?order=/, { timeout: 30000 });
  await assert.doesNotReject(async () => {
    await page.getByText(/order confirmed/i).waitFor({ timeout: 10000 });
  });

  await context.close();
  await browser.close();
});
