import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'data', 'burger-products.json');

async function main() {
  console.log('🚀 Starting Fast Burger DB Import via API route (CLI)');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  console.log('📡 Triggering the Next.js API route to import 7,700 items...');

  try {
    const req = await fetch('http://localhost:3000/api/import-burger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!req.ok) {
      throw new Error(`API returned ${req.status}: ${await req.text().catch(() => 'unknown error')}`);
    }

    const result = await req.json();

    if (result.success) {
      console.log(`✅ Burger Import OK! Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}`);
    } else {
      console.error(`❌ Burger API Error: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`❌ Network Error: ${error.message}`);
  }

  console.log(`\n🎉 Burger DB Import Trigger Script Complete!`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
