import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // A known working page for a high end car that definitely has GTS Black
  const testUrl = "https://www.racechip.eu/shop/bmw/x5-f15-2013-to-2018/m-50d-2993ccm-381hp-280kw-740nm.html";
  console.log('Navigating to:', testUrl);
  
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  
  // 1. Check title
  const title = await page.title();
  console.log('Title:', title);
  
  // 2. Output the HTML of the component that holds the product tiers
  // Usually it's in a div like .product-box or .tuning-box
  const tabsHtml = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, div')).filter(el => el.textContent.includes('GTS Black')).map(el => el.outerHTML).slice(0, 3);
  });
  console.log('\nGTS Black elements found:\n', tabsHtml);

  // 3. Look for App Control
  const appHtml = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('label, div')).filter(el => el.textContent.includes('App') || el.textContent.includes('Smartphone')).map(el => el.outerHTML).slice(0, 3);
  });
  console.log('\nApp Control elements found:\n', appHtml);
  
  await browser.close();
}

main().catch(console.error);
