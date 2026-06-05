import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

async function fetchSearchPage(query: string) {
  const url = `https://gp-portal.eu/search?q=${query}&options%5Bprefix%5D=last&filter.p.tag=Car-Part`;
  console.log(`Fetching search page for ${query}: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    fs.writeFileSync(path.resolve(process.cwd(), 'archive', 'scratch', `gp-portal-${query}-raw.html`), html, 'utf8');
    console.log(`Saved raw HTML to gp-portal-${query}-raw.html (${html.length} bytes)`);

    const $ = cheerio.load(html);
    const products: any[] = [];

    // On GP Portal search page, products are listed in a grid.
    // Let's find product links and image sources.
    $('.grid__item, .card, .product-card').each((_, el) => {
      const title = $(el).find('.card__heading, .product-card__title, a.t4s-product-title').text().trim();
      const href = $(el).find('a').attr('href') || '';
      const img = $(el).find('img').attr('src') || $(el).attr('data-src') || '';
      
      if (title && href) {
        products.push({
          title,
          href,
          image: img
        });
      }
    });

    // Also regex match for product handles and images
    console.log(`Cheerio found ${products.length} product elements in grid.`);
    
    // Let's do a search for products in JSON LD or script tags if they exist.
    // Usually Shopify has search results in window.Shopify or window.theme or script tag
    // Let's regex search for "/products/urb-" or similar inside the page
    const productRegex = /\/products\/[a-z0-9\-]+/gi;
    const matches = [...html.matchAll(productRegex)];
    const uniqueHandles = [...new Set(matches.map(m => m[0]))];
    console.log(`Regex found ${uniqueHandles.length} product URL handles:`, uniqueHandles.slice(0, 10));

    return {
      handles: uniqueHandles,
      gridProducts: products
    };
  } catch (err: any) {
    console.error(`Error fetching search page: ${err.message}`);
    return null;
  }
}

async function main() {
  await fetchSearchPage('L460');
}

main();
