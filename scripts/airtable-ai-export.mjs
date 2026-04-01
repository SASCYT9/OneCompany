import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Products';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const TARGET_BRANDS = ['KW', 'do88', 'Akrapovic', 'CSF', 'EBC'];
const CONCURRENCY = 4;
const BATCH_SIZE = 10;
const isDryRun = process.argv.includes('--dry-run');

if (!isDryRun && (!AIRTABLE_PAT || !AIRTABLE_BASE_ID)) {
  console.error("Missing AIRTABLE_PAT or AIRTABLE_BASE_ID.");
  process.exit(1);
}

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error("Missing CLOUDFLARE Cloudflare AI tokens.");
  process.exit(1);
}

/**
 * Extracts Category and Vehicle Fitment using Llama 3
 */
async function aiExtractProductData(productTitle, variantTitle, brand, desc, retries = 2) {
  const fullTitle = `${productTitle} ${variantTitle ? '- ' + variantTitle : ''}`;
  const aiParams = {
    model: '@cf/meta/llama-3.1-8b-instruct',
    messages: [
      {
        role: 'system',
        content: `You are an auto-parts categorization AI. Your task is to analyze the product and extract:
1. "category": A short, standard automotive category name (e.g. "Intercooler", "Exhaust System", "Coilovers", "Brake Pads", "Air Filter"). Use English.
2. "vehicle_fitment": A comma-separated string of the car models this fits (e.g. "BMW F80 M3, F82 M4"). If universal or unknown, return "". 
Return ONLY a strictly valid JSON object without markdown or extra text. Format: {"category": string, "vehicle_fitment": string}`
      },
      {
        role: 'user',
        content: `Brand: ${brand}\nTitle: ${fullTitle}\nDescription snippet: ${(desc || '').slice(0, 1000)}`
      }
    ]
  };

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${aiParams.model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(aiParams)
      }
    );

    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    let rawText = data.result?.response || '';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(rawText);
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return aiExtractProductData(productTitle, variantTitle, brand, desc, retries - 1);
    }
    return { category: 'Other', vehicle_fitment: '' };
  }
}

/**
 * Push to airtable
 */
async function pushToAirtableBatch(records) {
  const creates = [];
  const updates = [];

  for (const r of records) {
    const payload = {
      fields: {
        "SKU": r.sku || '',
        "Title": r.title || 'No Title',
        "Price": r.price || 0,
        "Brand": r.brand || '',
        "Category": r.category || '',
        "Vehicle Fitment": r.fitment || '',
        "Weight (kg)": r.weight || 0,
        "Source": r.source || 'Local'
      }
    };
    if (r.airtableRecordId) {
      updates.push({ id: r.airtableRecordId, fields: payload.fields });
    } else {
      creates.push(payload);
    }
  }

  const results = [];

  // Creates
  if (creates.length > 0) {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: creates, typecast: true })
    });
    if (res.ok) {
       const json = await res.json();
       results.push(...(json.records || []));
    } else {
       console.error("Create error:", await res.text());
    }
  }

  // Updates
  if (updates.length > 0) {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: updates, typecast: true })
    });
    if (res.ok) {
        const json = await res.json();
        results.push(...(json.records || []));
    } else {
        console.error("Update error:", await res.text());
    }
  }

  return results; // Array of items containing { id: 'recXYZ', fields: { SKU: ... } }
}

async function run() {
  console.log('🤖 Starting Airtable AI Bulk Export');
  if (isDryRun) console.log('⚠️ DRY RUN MODE: Will not send to Airtable.\n');

  // Find target variants
  const variants = await prisma.shopProductVariant.findMany({
    include: { product: true },
    where: { 
      sku: { not: null },
      product: { brand: { in: TARGET_BRANDS } }
    }
  });

  console.log(`Found ${variants.length} local items matching target brands.`);
  if (variants.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const startTime = Date.now();
  let doneCount = 0;
  let errorCount = 0;
  let idx = 0;
  const processedData = []; // To batch upload

  // AI Pipeline Worker
  async function worker(workerId) {
    while (idx < variants.length) {
      const myIdx = idx++;
      const v = variants[myIdx];
      
      const productTitle = v.product?.titleEn || v.product?.titleUa || '';
      const brand = v.product?.brand || 'Unknown';
      const desc = v.product?.bodyHtmlEn || '';
      
      let aiData = { category: 'Uncategorized', vehicle_fitment: '' };
      
      try {
        aiData = await aiExtractProductData(productTitle, v.title, brand, desc);
        processedData.push({
          dbId: v.id,
          airtableRecordId: v.airtableRecordId,
          sku: v.sku,
          title: `${productTitle} ${v.title ? v.title : ''}`.trim(),
          price: Number(v.priceUsd) || 0,
          brand,
          weight: v.weight || 0,
          source: 'Local',
          category: (aiData.category || '').substring(0, 200),
          fitment: (aiData.vehicle_fitment || '').substring(0, 1000)
        });
        doneCount++;
      } catch (err) {
        errorCount++;
      }

      const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      process.stdout.write(
        `\r  🤖 AI Processing: ${doneCount}/${variants.length} (Errors: ${errorCount}) | Time: ${totalElapsed}m ... `
      );
    }
  }

  console.log('Spawning AI processing workers...');
  const workers = Array.from({ length: CONCURRENCY }).map((_, i) => worker(i));
  await Promise.all(workers);

  console.log(`\n✅ AI processing complete. Successfully enriched ${processedData.length} items.`);

  if (isDryRun) {
    console.log('\n--- DRY RUN SAMPLE DATA ---');
    console.log(JSON.stringify(processedData.slice(0, 3), null, 2));
    await prisma.$disconnect();
    return;
  }

  // Batch upload to Airtable
  console.log('\n☁️ Syncing payload to Airtable...');
  let syncSuccess = 0;

  for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
    const chunk = processedData.slice(i, i + BATCH_SIZE);
    
    // Map of SKU -> dbId so we can update our DB after Airtable creates/updates
    const skuToDbId = {};
    chunk.forEach(r => { skuToDbId[r.sku] = r.dbId; });

    const results = await pushToAirtableBatch(chunk);
    
    // Iterate over results to update Database with new airtableRecordIds
    let dbUpdates = 0;
    for (const airtableRec of results) {
       const recSku = airtableRec.fields?.['SKU'];
       const airId = airtableRec.id;
       const dbId = skuToDbId[recSku];
       
       if (dbId && airId) {
         await prisma.shopProductVariant.update({
            where: { id: dbId },
            data: { airtableRecordId: airId, airtableSyncedAt: new Date() }
         });
         dbUpdates++;
       }
    }
    syncSuccess += dbUpdates;
    process.stdout.write(`\r  🔄 Synced: ${Math.min(i + BATCH_SIZE, processedData.length)}/${processedData.length}`);
    await new Promise(r => setTimeout(r, 250)); // rate limit protection
  }

  console.log(`\n🚀 Done! Final synced variants into Airtable and updated DB: ${syncSuccess}`);
  await prisma.$disconnect();
}

run().catch(console.error);
