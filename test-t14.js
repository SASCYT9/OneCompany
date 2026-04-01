const dotenv = require('dotenv');
dotenv.config({ path: 'd:/OneCompany/.env' });
const fetch = require('node-fetch') || globalThis.fetch;

async function getAccessToken() {
  const credentials = Buffer.from(`${process.env.TURN14_CLIENT_ID}:${process.env.TURN14_CLIENT_SECRET}`).toString('base64');
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
    console.log('First item:', data.data[0].attributes?.product_name, data.data[0].attributes?.brand);
  } else {
    console.log('API returned 0 items.');
  }
}

searchTurn14('eventuri').catch(console.error);
searchTurn14('mishimoto').catch(console.error);
