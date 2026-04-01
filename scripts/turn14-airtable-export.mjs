import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env.local' });

// Configuration
const TURN14_CLIENT_ID = process.env.TURN14_CLIENT_ID || 'f7a47aba33fa6f87a218de26e824d32e499d58e9';
const TURN14_CLIENT_SECRET = process.env.TURN14_CLIENT_SECRET || 'efc5ff7645b09faa8c9b5c602a6c8fec2937f89f';
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Товары/Услуги test';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// Target Configuration
const TARGET_BRANDS = ['kw', 'do88', 'akrapovic', 'csf', 'ebc', 'kw suspensions', 'ebc brakes'];
const isDryRun = process.argv.includes('--dry-run');

// --- Airtable Utilities ---
let airtableSkuMap = {};

async function fetchAirtableExistingSkus() {
  console.log('☁️ Fetching existing records from Airtable to map SKUs...');
  let offset = null;
  let count = 0;
  
  do {
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?fields%5B%5D=SKU`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` } });
    if (!res.ok) {
       console.error("Failed to fetch Airtable mapping:", await res.text());
       break;
    }
    const data = await res.json();
    for (const r of data.records) {
       const sku = r.fields?.['SKU'];
       if (sku) airtableSkuMap[sku] = r.id;
    }
    count += data.records.length;
    offset = data.offset;
  } while (offset);
  
  console.log(`☁️ Found ${count} existing items in Airtable.`);
}

async function pushToAirtableBatch(records) {
  const creates = [];
  const updates = [];

  for (const r of records) {
    const payloadFields = {
      "SKU": r.sku || '',
      "Title": r.title || 'No Title',
      "Brand": r.brand || '',
      "Category": r.category || 'Uncategorized',
    };
    
    // Fitment is multiple select, needs array of strings
    if (r.fitment) {
      payloadFields["Fitment"] = r.fitment.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    if (r.weight) payloadFields["Weight (lbs)"] = Number(r.weight);
    if (r.length) payloadFields["Length (in)"] = Number(r.length);

    const mappedId = airtableSkuMap[r.sku];
    if (mappedId) {
      updates.push({ id: mappedId, fields: payloadFields });
    } else {
      creates.push({ fields: payloadFields });
    }
  }

  // Handle Creates 10 at a time
  for (let i=0; i<creates.length; i+=10) {
    const chunk = creates.slice(i, i+10);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: chunk, typecast: true })
    });
    if (!res.ok) console.error("Airtable Create Error:", await res.text());
  }

  // Handle Updates 10 at a time
  for (let i=0; i<updates.length; i+=10) {
    const chunk = updates.slice(i, i+10);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: chunk, typecast: true })
    });
    if (!res.ok) console.error("Airtable Patch Error:", await res.text());
  }
}

// --- Cloudflare AI Utilities ---
async function aiExtractProductData(title, brand) {
  const aiParams = {
    model: '@cf/meta/llama-3.1-8b-instruct',
    messages: [
      {
        role: 'system',
        content: `You are an auto-parts AI. Analyze the product title.
1. "category": Choose one concise English category (e.g. "Intercooler", "Exhaust System", "Coilovers", "Brake Pads", "Air Filter", "Suspension Kit").
2. "fitment": Comma-separated list of vehicle models it fits (e.g. "BMW F80 M3, F82 M4"). If universal or unmentioned, use "".
Return ONLY strictly valid JSON: {"category": string, "fitment": string}`
      },
      { role: 'user', content: `Brand: ${brand}\nTitle: ${title}` }
    ]
  };

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${aiParams.model}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(aiParams)
      }
    );
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    let rawText = data.result?.response || '';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(rawText);
  } catch (err) {
    return { category: 'Other', fitment: '' };
  }
}

// --- Turn14 Utilities ---
async function getTurn14AccessToken() {
  const response = await fetch(`https://api.turn14.com/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: TURN14_CLIENT_ID, client_secret: TURN14_CLIENT_SECRET }),
  });
  if (!response.ok) throw new Error('Failed to fetch Turn14 token');
  const data = await response.json();
  return data.access_token;
}

// Full catalogue scan to guarantee exact target extraction since API filtering is spotty 
async function fetchTargetTurn14Items(token) {
  console.log('🔄 Scanning Turn14 Wholesale Catalog...');
  let targetItems = [];
  let page = 1;

  while(true) {
    const res = await fetch(`https://api.turn14.com/v1/items?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) break;
    const body = await res.json();
    const items = body.data || [];
    if (items.length === 0) break;
    
    // Filter locally instead of trusting Turn14's search
    for (const item of items) {
      const attrs = item.attributes || {};
      const tBrand = (attrs.brand_short_description || attrs.brand || '').toLowerCase();
      
      const isTarget = TARGET_BRANDS.some(tb => tBrand.includes(tb));
      if (isTarget) {
         // Also fetch the full details for dimensions
         // BUT since dimensions aren't always here, we'll try to extract them from current array.
         const weight = attrs.weight || attrs.dimensions?.[0]?.weight || 0;
         const length = attrs.dimensions?.[0]?.length || 0;

         targetItems.push({
            id: item.id,
            sku: attrs.mfr_part_number || attrs.part_number || attrs.internal_part_number || '',
            title: attrs.item_name || attrs.product_name || '',
            brand: attrs.brand || tBrand,
            weight,
            length
         });
      }
    }
    
    if (page % 10 === 0) process.stdout.write(`\r  Scanned ${page}/${body.meta?.total_pages || '?'} pages... Found ${targetItems.length} target items`);
    if (page >= (body.meta?.total_pages || 1)) break;
    
    // Fast demonstration cutoff for dry runs
    if (isDryRun && page >= 10) break;
    
    page++;
  }
  return targetItems;
}

// --- Main Execution ---
async function run() {
  console.log('=== Turn14 ➡️ Airtable Full Sync Engine ===');
  
  if (!isDryRun) {
     if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
        console.error("Missing AIRTABLE_PAT or AIRTABLE_BASE_ID in environment.");
        process.exit(1);
     }
     await fetchAirtableExistingSkus();
  } else {
     console.log('⚠️ DRY RUN MODE. Data will NOT be pushed to Airtable.');
  }

  const t14Token = await getTurn14AccessToken();
  const rawItems = await fetchTargetTurn14Items(t14Token);
  
  if (rawItems.length === 0) return;

  console.log(`\n✅ Located ${rawItems.length} active matching products from Turn14.`);

  if (rawItems.length === 0) return;

  console.log('\n🤖 Triggering Cloudflare Llama 3 for intelligent classification...');
  let enrichedItems = [];
  let processedCount = 0;
  let startTime = Date.now();

  // Simple concurrency queue
  let i = 0;
  async function worker() {
    while(i < rawItems.length) {
      const myItem = rawItems[i++];
      const aiData = await aiExtractProductData(myItem.title, myItem.brand);
      enrichedItems.push({
         ...myItem,
         category: aiData.category,
         fitment: aiData.fitment
      });
      processedCount++;
      const speed = (Date.now() - startTime) / processedCount;
      const remainingMinutes = ((rawItems.length - processedCount) * speed / 60000).toFixed(1);
      
      if (processedCount % 10 === 0) {
        process.stdout.write(`\r  Classification: ${processedCount}/${rawItems.length} | ETA: ${remainingMinutes}m`);
      }
    }
  }

  // 4 concurrent tasks
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`\n✅ AI Classification complete.`);

  if (isDryRun) {
    console.log('\n--- DRY RUN SAMPLE DUMP (3 ITEMS) ---');
    console.log(JSON.stringify(enrichedItems.slice(0, 3), null, 2));
    return;
  }

  // Sync to Airtable
  console.log('\n☁️ Synchronizing blocks to Airtable (via typecast:true)...');
  for (let c=0; c<enrichedItems.length; c+=100) { // Push slices to prevent memory spikes in fetch
     const block = enrichedItems.slice(c, c+100);
     await pushToAirtableBatch(block);
     process.stdout.write(`\r  Synced: ${Math.min(c+100, enrichedItems.length)}/${enrichedItems.length}`);
     await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n🎉 Finished! Turn14 data successfully mirrored to Airtable.');
}

run().catch(console.error);
