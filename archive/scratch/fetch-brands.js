const fetch = require('node-fetch') || globalThis.fetch;
const fs = require('fs');

async function getAccessToken() {
  const credentials = Buffer.from('f7a47aba33fa6f87a218de26e824d32e499d58e9:efc5ff7645b09faa8c9b5c602a6c8fec2937f89f').toString('base64');
  const response = await fetch('https://api.turn14.com/v1/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  return data.access_token;
}

async function run() {
  const token = await getAccessToken();
  const resBrands = await fetch('https://api.turn14.com/v1/brands', { headers: { Authorization: `Bearer ${token}` } });
  const brandsData = await resBrands.json();
  fs.writeFileSync('D:/OneCompany/turn14_brands.json', JSON.stringify(brandsData, null, 2));
  console.log(`Saved ${brandsData.data.length} brands`);
}

run().catch(console.error);
