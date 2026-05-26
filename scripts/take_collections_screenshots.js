const { chromium } = require("playwright");
const path = require("path");

async function run() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();

  // Set viewport
  await page.setViewportSize({ width: 1280, height: 1200 });

  // Moto catalog
  console.log("Navigating to http://localhost:3000/ua/shop/akrapovic/collections?scope=moto...");
  await page.goto("http://localhost:3000/ua/shop/akrapovic/collections?scope=moto");
  await page.waitForTimeout(4000);
  const screenshotMotoPath = path.join(
    "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da",
    "moto_collections_screenshot.png"
  );
  await page.screenshot({ path: screenshotMotoPath });
  console.log(`Moto catalog screenshot saved to: ${screenshotMotoPath}`);

  // Auto catalog
  console.log("Navigating to http://localhost:3000/ua/shop/akrapovic/collections?scope=auto...");
  await page.goto("http://localhost:3000/ua/shop/akrapovic/collections?scope=auto");
  await page.waitForTimeout(4000);
  const screenshotAutoPath = path.join(
    "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da",
    "auto_collections_screenshot.png"
  );
  await page.screenshot({ path: screenshotAutoPath });
  console.log(`Auto catalog screenshot saved to: ${screenshotAutoPath}`);

  await browser.close();
}

run().catch(console.error);
