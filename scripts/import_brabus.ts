import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'brabus-seo-catalog-cleaned.json');

async function main() {
  console.log('🚀 Starting Fast Brabus DB Import via API Proxy');
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const allProducts = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`📦 Loaded ${allProducts.length} catalog items for fast DB import.`);

  console.log('📡 Sending payload to internal Next.js API route in batches... Please wait.');
  
  const CHUNK_SIZE = 5;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (let i = 0; i < allProducts.length; i += CHUNK_SIZE) {
    const chunk = allProducts.slice(i, i + CHUNK_SIZE);
    process.stdout.write(`\n📤 Sending batch ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} items)... `);

    try {
      const req = await fetch('http://localhost:3000/api/import-brabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });

      if (!req.ok) {
        throw new Error(`API returned ${req.status}: ${await req.text().catch(() => 'unknown error')}`);
      }

      const { success, created, updated, errors, error } = await req.json();

      if (success) {
        totalCreated += created;
        totalUpdated += updated;
        totalErrors += errors;
        console.log(`✅ OK (+${created} created, +${updated} updated)`);
      } else {
        console.error(`❌ Batch Error: ${error}`);
      }
      
      // Delay to allow Next.js and Prisma to breathe
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      console.error(`❌ Network Error on batch: ${error.message}`);
      await new Promise(r => setTimeout(r, 5000)); // wait longer on error
    }
  }

  console.log(`\n🎉 DB Import Complete!`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Errors : ${totalErrors}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
