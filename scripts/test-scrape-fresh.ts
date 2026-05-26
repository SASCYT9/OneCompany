import { chromium } from "playwright";

async function test() {
  const skus = ["S-B13SO4-HJGT", "CB-B13T1", "S-D9E7-CKOT"];

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    const url = `https://atomic-shop.ua/search?type=product&q=${encodeURIComponent(sku)}`;
    console.log(`[${i + 1}/${skus.length}] Navigating to ${url}...`);

    // Launch a completely new browser instance for this request
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      console.log(`Response status: ${res?.status()} | Title: ${await page.title()}`);

      const html = await page.content();
      console.log(`HTML Length: ${html.length}`);
    } catch (err) {
      console.error(`Failed:`, err);
    } finally {
      await browser.close();
    }

    if (i < skus.length - 1) {
      console.log("Waiting 3 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

test();
