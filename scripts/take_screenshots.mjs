import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const capture = async (url, name) => {
    try {
      console.log(`Capturing ${name}...`);
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(6000); // Wait for Turbopack to compile and images to load
      await page.screenshot({ path: `d:\\OneCompany\\wiki\\screenshots\\real_${name}.png`, fullPage: false });
      await page.close();
      console.log(`Saved ${name}.png`);
    } catch (e) {
      console.log(`Failed to capture ${name}: ${e.message}`);
    }
  };

  await capture('http://localhost:3001/shop/akrapovic', 'akrapovic');
  await capture('http://localhost:3001/shop/ohlins', 'ohlins');
  await capture('http://localhost:3001/shop/urban', 'urban');
  await capture('http://localhost:3001/shop/burger', 'burger');

  await browser.close();
  process.exit(0);
})();
