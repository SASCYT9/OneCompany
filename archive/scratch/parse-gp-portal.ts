import fs from 'fs';
import * as cheerio from 'cheerio';

const contentPath = 'C:\\Users\\sascy\\.gemini\\antigravity\\brain\\7c70febe-7c18-4d9f-8124-827af947b370\\.system_generated\\steps\\16\\content.md';

function main() {
  const html = fs.readFileSync(contentPath, 'utf8');
  const $ = cheerio.load(html);

  console.log('--- EXTRACTING FROM HTML PRODUCTS ---');
  const products: any[] = [];
  
  // Shopify Dawn product card structure:
  // Usually has a list of grid__item elements. Let's find links inside cards
  $('.grid__item, .card, .card-wrapper').each((i, el) => {
    const card = $(el);
    const link = card.find('a[href*="/products/"]').first();
    if (!link.length) return;
    
    const href = link.attr('href') || '';
    const handleMatch = href.match(/\/products\/([^?#]+)/);
    if (!handleMatch) return;
    const handle = handleMatch[1];
    
    const titleEl = card.find('.card__heading, .full-unstyled-link, h3').first();
    const title = titleEl.text().trim();
    
    // Find all images within this card
    const images: string[] = [];
    card.find('img').each((j, imgEl) => {
      const src = $(imgEl).attr('src') || $(imgEl).attr('data-src') || '';
      if (src && !src.includes('placeholder') && (src.includes('cdn.shopify.com') || src.includes('gp-portal.eu'))) {
        images.push(src);
      }
    });

    if (handle) {
      products.push({
        handle,
        title,
        images: [...new Set(images)]
      });
    }
  });

  // Deduplicate products by handle
  const uniqueProducts = new Map<string, any>();
  for (const p of products) {
    if (!uniqueProducts.has(p.handle)) {
      uniqueProducts.set(p.handle, p);
    } else {
      // Merge images
      const existing = uniqueProducts.get(p.handle);
      existing.images = [...new Set([...existing.images, ...p.images])];
    }
  }

  console.log(`Found ${uniqueProducts.size} unique products in HTML:`);
  for (const [handle, p] of uniqueProducts.entries()) {
    console.log(`Handle: ${handle}\n  Title: ${p.title}\n  Images: ${JSON.stringify(p.images)}`);
  }
}

main();
