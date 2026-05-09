const https = require('https');
https.get('https://www.akrapovic.com/en/car/product/21570/Audi/RS-6-Avant-C8/Evolution-Line-Titanium?brandId=14&modelId=1101&yearId=7227', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // try any relative or absolute img tags
    const imgs = data.match(/<img[^>]+src="?([^"\s]+)/ig) || [];
    const set = Array.from(new Set(imgs)).slice(0, 15).join('\n');
    console.log(set);
  });
});
