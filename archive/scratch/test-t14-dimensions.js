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
  const data = await response.json();
  return data.access_token;
}

async function getEventuriItems() {
  const token = await getAccessToken();
  // 1. Get Eventuri Brand ID
  console.log('Fetching Brands...');
  const resBrands = await fetch('https://api.turn14.com/v1/brands', { headers: { Authorization: `Bearer ${token}` } });
  const brandsData = await resBrands.json();
  const eventuri = brandsData.data?.find(b => b.attributes.name.toLowerCase().includes('eventuri'));
  console.log('Eventuri Brand:', eventuri?.id, eventuri?.attributes);

  if (!eventuri) return;

  // 2. Fetch Items for Eventuri
  const url = `https://api.turn14.com/v1/items?brand=${eventuri.id}&page=1`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  
  if (data.data?.length > 0) {
    console.log(`First Eventuri Item:`);
    const row = data.data[0].attributes;
    console.log(`- ${row.part_number} | MPN: ${row.mfg_part_number}`);
    console.log(`- Dimensions (inches): L: ${row.box_length} W: ${row.box_width} H: ${row.box_height} Weight (lbs): ${row.weight}`);
  }
}

getEventuriItems().catch(console.error);
