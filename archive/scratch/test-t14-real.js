const fetch = require('node-fetch') || globalThis.fetch;

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
  if (!response.ok) throw new Error('Token failed');
  const data = await response.json();
  return data.access_token;
}

async function searchTurn14(keyword) {
  const token = await getAccessToken();
  const url = `https://api.turn14.com/v1/items?keyword=${encodeURIComponent(keyword)}&page=1`;
  console.log('Fetching:', url);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  
  if (!response.ok) {
     console.error('Failed:', response.status, await response.text());
     return;
  }
  
  const data = await response.json();
  console.log(`Found ${data.data?.length || 0} items for keyword "${keyword}"`);
  if (data.data?.length > 0) {
    for (let i = 0; i < Math.min(3, data.data.length); i++) {
       const row = data.data[i].attributes;
       console.log(`- ${row.part_number} | ${row.brand} | ${row.product_name} | W:${row.weight} L:${row.length} W:${row.width} H:${row.height}`);
    }
  } else {
    console.log('API returned 0 items.');
  }
}

searchTurn14('eventuri').catch(console.error);
