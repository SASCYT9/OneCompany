async function checkProduct(handle: string) {
  const url = `https://gp-portal.eu/products/${handle}`;
  console.log(`Checking ${handle}: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      const html = await response.text();
      console.log(`  HTML Length: ${html.length}`);
      // Find files
      const regex = /\/\/gp-portal\.eu\/cdn\/shop\/files\/[^"\s?]+/g;
      const matches = [...html.matchAll(regex)];
      const urls = [...new Set(matches.map(m => {
        let clean = m[0];
        if (clean.startsWith('//')) clean = 'https:' + clean;
        return clean.split('&width=')[0].split('&amp;width=')[0].split('?width=')[0].split('?v=')[0];
      }))];
      console.log(`  Found URLs (${urls.length}):`);
      urls.forEach(u => console.log(`    - ${u}`));
    }
  } catch (err: any) {
    console.error(`  Error checking ${handle}: ${err.message}`);
  }
}

async function main() {
  await checkProduct('urb-gri-26006222-v1');
  await checkProduct('urb-sil-26006225-v1');
}

main();
