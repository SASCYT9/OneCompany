const { chromium } = require("playwright");
const path = require("path");

async function run() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();

  // Set viewport
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log("Navigating to http://localhost:3000/ua/shop/akrapovic...");
  await page.goto("http://localhost:3000/ua/shop/akrapovic");
  await page.waitForTimeout(2000);
  const screenshotPortalPath = path.join(__dirname, "portal_screenshot.png");
  await page.screenshot({ path: screenshotPortalPath });
  console.log(`Portal screenshot saved to: ${screenshotPortalPath}`);

  // Scroll to the bottom to see the global footer
  console.log("Scrolling to bottom of the portal page...");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  const screenshotPortalScrollPath = path.join(__dirname, "portal_scroll_screenshot.png");
  await page.screenshot({ path: screenshotPortalScrollPath });
  console.log(`Portal scroll screenshot saved to: ${screenshotPortalScrollPath}`);

  console.log("Navigating to http://localhost:3000/ua/shop/akrapovic?segment=auto...");
  await page.goto("http://localhost:3000/ua/shop/akrapovic?segment=auto");
  await page.waitForTimeout(2000);
  const screenshotAutoPath = path.join(__dirname, "auto_screenshot.png");
  await page.screenshot({ path: screenshotAutoPath });
  console.log(`Auto screenshot saved to: ${screenshotAutoPath}`);

  console.log("Navigating to http://localhost:3000/ua/shop/akrapovic?segment=moto...");
  await page.goto("http://localhost:3000/ua/shop/akrapovic?segment=moto");
  await page.waitForTimeout(2000);
  const screenshotMotoPath = path.join(__dirname, "moto_screenshot.png");
  await page.screenshot({ path: screenshotMotoPath });
  console.log(`Moto screenshot saved to: ${screenshotMotoPath}`);

  // Scroll to sound section
  console.log("Scrolling to sound section...");
  const soundsSelector = ".ak-sounds";
  await page.locator(soundsSelector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  const screenshotSoundsPath = path.join(__dirname, "moto_sounds_screenshot.png");
  await page.screenshot({ path: screenshotSoundsPath });
  console.log(`Moto sounds screenshot saved to: ${screenshotSoundsPath}`);

  await browser.close();
}

run().catch(console.error);
