import * as cheerio from "cheerio";
import { Page } from "playwright";

export interface ScrapedProduct {
  priceUah: number;
  stockQty: number;
  stockStatus: "inStock" | "outOfStock";
}

export function parseHtmlPrice(priceText: string): number | undefined {
  const match = priceText.match(/₴\s*([\d\s,.]+)/);
  if (!match) return undefined;

  let cleaned = match[1].trim();
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\s/g, "");
    if (/, \d{2}$/.test(cleaned) || /,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else {
    cleaned = cleaned.replace(/\s/g, "");
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : Math.round(parsed);
}

export async function fetchPriceFromAtomicSiteWithPage(
  page: Page,
  sku: string
): Promise<ScrapedProduct | undefined> {
  const url = `https://atomic-shop.ua/search?type=product&q=${encodeURIComponent(sku)}`;
  try {
    console.log(`[Scraper] Navigating to ${url}...`);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    if (!response) {
      console.warn(`[Scraper] No response for SKU: ${sku}`);
      return undefined;
    }
    console.log(`[Scraper] Response status: ${response.status()}`);

    if (response.status() === 403) {
      console.warn(`[Scraper] Access denied (403) for SKU: ${sku}`);
      return undefined;
    }

    try {
      await page.waitForSelector(".product-item, .search-page, .main-content", { timeout: 4000 });
    } catch (e) {
      console.log(`[Scraper] Selector wait timeout for SKU: ${sku}`);
    }

    const html = await page.content();
    console.log(`[Scraper] Page content length: ${html.length} for SKU: ${sku}`);

    const $ = cheerio.load(html);
    const productItems = $(".product-item");
    console.log(`[Scraper] Found ${productItems.length} elements matching '.product-item'`);

    const items: {
      title: string;
      href: string;
      price: number;
      stockQty: number;
      stockStatus: "inStock" | "outOfStock";
    }[] = [];

    productItems.each((_, el) => {
      const title = $(el)
        .find("[class*='title'], [class*='name'], a")
        .text()
        .trim()
        .replace(/\s+/g, " ");
      const href = $(el).find("a").attr("href") || "";
      const priceText = $(el).find(".price, .price-list").text().trim().replace(/\s+/g, " ");

      const parsedPrice = parseHtmlPrice(priceText);
      if (parsedPrice === undefined) return;

      const labels = $(el)
        .find(".label")
        .map((_, labelEl) => $(labelEl).text().trim().toLowerCase())
        .get();

      let stockQty = 0;
      let stockStatus: "inStock" | "outOfStock" = "outOfStock";

      if (
        labels.some(
          (l) => l.includes("наявності") || l.includes("на складі") || l.includes("stock")
        )
      ) {
        stockQty = 1;
        stockStatus = "inStock";
      } else if (labels.some((l) => l.includes("замовлення") || l.includes("order"))) {
        stockQty = 0;
        stockStatus = "outOfStock";
      } else {
        const buttonText = $(el).find("button").text().trim().toLowerCase();
        if (buttonText.includes("кошик")) {
          stockQty = 0;
          stockStatus = "outOfStock";
        }
      }

      items.push({ title, href, price: parsedPrice, stockQty, stockStatus });
    });

    if (items.length === 0) {
      console.log(`[Scraper] No products parsed for SKU: ${sku}`);
      return undefined;
    }

    const normalizedTarget = sku.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const item of items) {
      const titleLower = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hrefLower = item.href.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (titleLower.includes(normalizedTarget) || hrefLower.includes(normalizedTarget)) {
        return {
          priceUah: item.price,
          stockQty: item.stockQty,
          stockStatus: item.stockStatus,
        };
      }
    }
    console.log(`[Scraper] No products matched normalized SKU check for SKU: ${sku}`);
  } catch (err) {
    console.error(`[Scraper] Error scraping SKU ${sku}:`, err);
  }
  return undefined;
}

export async function fetchPriceFromAtomicSite(sku: string): Promise<ScrapedProduct | undefined> {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    return await fetchPriceFromAtomicSiteWithPage(page, sku);
  } finally {
    await browser.close();
  }
}
