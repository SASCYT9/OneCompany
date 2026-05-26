import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { parseHtmlPrice } from "./_lib/atomic-scraper";

async function test() {
  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const sku = "S-B13SO4-HJGT";
  const url = `https://atomic-shop.ua/search?type=product&q=${encodeURIComponent(sku)}`;
  console.log(`Navigating to ${url}...`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForSelector(".product-item, .search-page, .main-content", { timeout: 3000 });
    } catch (e) {
      console.log("Selector wait timeout.");
    }

    const html = await page.content();
    console.log("HTML length:", html.length);

    const $ = cheerio.load(html);
    const productItems = $(".product-item");
    console.log(`Found ${productItems.length} elements matching '.product-item'`);

    const items: any[] = [];
    productItems.each((i, el) => {
      const title = $(el)
        .find("[class*='title'], [class*='name'], a")
        .text()
        .trim()
        .replace(/\s+/g, " ");
      const href = $(el).find("a").attr("href") || "";
      const priceText = $(el).find(".price, .price-list").text().trim().replace(/\s+/g, " ");
      const parsedPrice = parseHtmlPrice(priceText);
      const labels = $(el)
        .find(".label")
        .map((_, labelEl) => $(labelEl).text().trim().toLowerCase())
        .get();

      console.log(`[Item ${i}] Title: "${title}"`);
      console.log(`          Href: "${href}"`);
      console.log(`          Price text: "${priceText}" -> parsed: ${parsedPrice}`);
      console.log(`          Labels: ${JSON.stringify(labels)}`);

      items.push({ title, href, price: parsedPrice, labels });
    });

    const normalizedTarget = sku.toLowerCase().replace(/[^a-z0-9]/g, "");
    console.log(`Normalized Target SKU: "${normalizedTarget}"`);

    let matched = false;
    for (const item of items) {
      const titleLower = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hrefLower = item.href.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isMatch = titleLower.includes(normalizedTarget) || hrefLower.includes(normalizedTarget);
      console.log(`Item title normalized: "${titleLower}"`);
      console.log(`Item href normalized: "${hrefLower}"`);
      console.log(`=> Is match? ${isMatch}`);
      if (isMatch) matched = true;
    }
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

test();
