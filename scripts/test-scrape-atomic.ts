import { chromium } from "playwright";

async function test() {
  const collections = [
    "https://atomic-shop.ua/collections/akrapovic",
    "https://atomic-shop.ua/collections/akrapovic-moto",
    "https://atomic-shop.ua/collections/csf",
    "https://atomic-shop.ua/collections/ohlins",
  ];

  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of collections) {
    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      console.log(`URL: ${url} | Status: ${res?.status()} | Title: ${await page.title()}`);
    } catch (err) {
      console.error(`Failed to load ${url}:`, err);
    }
  }

  await browser.close();
}

test();
