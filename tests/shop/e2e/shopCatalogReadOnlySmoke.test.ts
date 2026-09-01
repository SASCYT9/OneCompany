import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.SHOP_E2E_BASE_URL || "http://127.0.0.1:3001";

test("catalog renders and hydrates without browser errors or writes", async (t) => {
  if (process.env.SHOP_BROWSER_E2E !== "1") {
    t.skip("Set SHOP_BROWSER_E2E=1 to run browser storefront smoke");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(`${baseUrl}/ua/shop/catalog`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  assert.equal(response?.status(), 200);
  assert.equal(await page.locator("main").count(), 1);
  assert.equal(await page.locator('[data-nextjs-dialog], .vite-error-overlay').count(), 0);
  assert.ok((await page.locator("body").innerText()).trim().length > 1_000);
  assert.ok(await page.locator('a[href^="/ua/shop/"]').count() >= 10);
  assert.ok(await page.locator("img").count() >= 5);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
});
