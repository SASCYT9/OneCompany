import 'dotenv/config';
import { getTurn14AccessToken } from './src/lib/turn14.js';

const TURN14_API_BASE = process.env.TURN14_API_BASE || 'https://api.turn14.com/v1';

async function testPricingIncludes() {
  const token = await getTurn14AccessToken();

  const url = `${TURN14_API_BASE}/items?keyword=100496`; // just fetching one by keyword to see
  console.log(`\nTesting: ${url}`);
  try {
    const response = await fetch(url + '&include=pricing', { headers: { Authorization: `Bearer ${token}` } });
    const json = await response.json();
    console.log('Includes pricing?', !!json.data[0]?.attributes?.pricing);
    console.log('Item fields:', Object.keys(json.data[0]?.attributes || {}));
  } catch (e) {
    console.error('Fetch error', e);
  }
}

testPricingIncludes();
