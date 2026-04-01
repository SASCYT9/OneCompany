import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Products';

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error("Missing AIRTABLE_PAT or AIRTABLE_BASE_ID.");
  process.exit(1);
}

// Airtable batch create max is 10 records per request
async function pushToAirtableBatch(records) {
  const payload = {
    records: records.map(r => ({
      fields: {
        "SKU": r.sku || '',
        "Title": r.title || 'No Title',
        "Price": r.price || 0,
        "Brand": r.brand || '',
        "Source": r.source || 'Local'
      }
    })),
    typecast: true
  };

  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Error] Failed chunk: ${response.status} ${errorText}`);
    return false;
  }
  return true;
}

async function run() {
  console.log(`Starting bulk export of internal catalog to Airtable Base (${AIRTABLE_BASE_ID}) Table (${TABLE_NAME})`);
  
  // Get all variants
  const variants = await prisma.shopProductVariant.findMany({
    include: { product: true },
    where: { NOT: { sku: null } }
  });

  console.log(`Found ${variants.length} local items with SKUs.`);

  // Transform data
  const transformed = variants.map(v => ({
    sku: v.sku,
    title: v.product?.titleEn || v.product?.titleUa || v.title,
    price: Number(v.priceUsd) || 0,
    brand: v.product?.brand || 'Unknown',
    source: 'Local'
  }));

  // Batch into arrays of 10
  let successCount = 0;
  let batchSize = 10;
  for (let i = 0; i < transformed.length; i += batchSize) {
    const chunk = transformed.slice(i, i + batchSize);
    console.log(`Pushing chunk ${Math.floor(i/10)+1}/${Math.ceil(transformed.length/10)}...`);
    const success = await pushToAirtableBatch(chunk);
    if (success) {
      successCount += chunk.length;
    }
    // simple rate limit delay
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`Done! Synced ${successCount}/${transformed.length} items to Airtable.`);

  await prisma.$disconnect();
}

run().catch(console.error);
