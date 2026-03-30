import * as cheerio from 'cheerio';

async function main() {
  const url = 'https://www.brabus.com/de-de/cars/tuning/auf-basis-mercedes/uebersicht/artikel/p/cls-klasse/c-257/amg-cls-53/f14-257-pe.html';
  const res = await fetch(url);
  const t = await res.text();
  const $ = cheerio.load(t);
  
  let price = 0;
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'Product' && data.offers && data.offers.price) {
        price = data.offers.price;
      }
    } catch(e) {}
  });
  
  // also look at data-tracking in product-teaser or similar
  let dataTrackingPrice = 0;
  $('[data-tracking]').each((i, el) => {
    try {
      const data = JSON.parse($(el).attr('data-tracking') || '{}');
      // Look for the main product ID "F14-257-PE" inside the products array
      if (data.products && Array.isArray(data.products)) {
        const p = data.products.find(x => x.id === 'F13-257-BP');
        if (p && p.price) dataTrackingPrice = p.price;
      }
    } catch(e) {}
  });

  console.log('Price from LD+JSON:', price);
  console.log('Price from data-tracking F13:', dataTrackingPrice);
}

main();
