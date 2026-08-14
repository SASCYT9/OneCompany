import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

(async () => {
  const baseUrl = String(process.env.SHOP_SCREENSHOT_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const outputDirectory = path.resolve("wiki", "screenshots");
  await fs.mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const capture = async (url, name) => {
    try {
      console.log(`Capturing ${name}...`);
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(6000); // Wait for Turbopack to compile and images to load
      await page.screenshot({
        path: path.join(outputDirectory, `real_${name}.png`),
        fullPage: false,
      });
      await page.close();
      console.log(`Saved ${name}.png`);
    } catch (e) {
      console.log(`Failed to capture ${name}: ${e.message}`);
    }
  };

  await capture(`${baseUrl}/ua/shop/akrapovic`, "akrapovic");
  await capture(`${baseUrl}/ua/shop/ohlins`, "ohlins");
  await capture(`${baseUrl}/ua/shop/urban`, "urban");
  await capture(`${baseUrl}/ua/shop/burger`, "burger");

  await browser.close();
  process.exit(0);
})();
