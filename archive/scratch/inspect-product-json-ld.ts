import * as cheerio from 'cheerio';

async function main() {
  const url = 'https://gp-portal.eu/products/urb-sid-26006229-v1';
  console.log(`Fetching product page: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    console.log('--- JSON-LD BLOCKS ---');
    $('script[type="application/ld+json"]').each((i, el) => {
      const text = $(el).text();
      try {
        const parsed = JSON.parse(text);
        if (parsed.image) {
          console.log(`Block ${i} image array:`, parsed.image);
        } else if (parsed['@graph']) {
          for (const item of parsed['@graph']) {
            if (item.image) console.log(`Graph item image:`, item.image);
          }
        }
      } catch (err: any) {
        console.log(`Block ${i} failed to parse:`, err.message);
      }
    });

    console.log('\n--- PRODUCT MEDIA ITEM IMAGES ---');
    // Common Dawn class names for media:
    $('.product__media img, .product__media-list img, .product-single__media img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      console.log(`Media image ${i}:`, src);
    });

  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
