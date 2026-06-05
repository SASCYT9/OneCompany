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
    console.log(`Fetched ${html.length} bytes of raw HTML.`);

    // Find all links to files in shop/files
    const regex = /\/\/gp-portal\.eu\/cdn\/shop\/files\/[^"\s]+/g;
    const matches = [...html.matchAll(regex)];
    const urls = [...new Set(matches.map(m => m[0]))];
    console.log('Found shop files URLs in HTML:', urls);
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
