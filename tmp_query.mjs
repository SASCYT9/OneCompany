import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  // Get ALL ohlins
  const all = await p.shopProduct.findMany({
    where: { brand: { contains: 'hlins', mode: 'insensitive' }, isPublished: true },
    select: { slug: true, titleEn: true, categoryEn: true },
    orderBy: { slug: 'asc' },
  });
  
  // Group by slug prefix (3-letter code)
  const prefixMap = {};
  const accessoryPrefixes = new Set();
  
  for (const p of all) {
    // Extract prefix from slug like "ohlins-bms-1u00" -> "bms"
    const parts = p.slug.replace('ohlins-', '').split('-');
    const prefix = parts[0];
    
    // Check if it's a 3-letter alpha code (car brand) vs numeric (accessory)
    if (/^[a-z]{3}$/i.test(prefix)) {
      if (!prefixMap[prefix]) prefixMap[prefix] = [];
      prefixMap[prefix].push(p);
    } else {
      accessoryPrefixes.add(prefix);
    }
  }
  
  console.log('\n=== VEHICLE KITS BY SLUG PREFIX ===');
  const sorted = Object.entries(prefixMap).sort((a,b) => b[1].length - a[1].length);
  for (const [prefix, products] of sorted) {
    console.log(`\n  ${prefix.toUpperCase()} (${products.length} products):`);
    products.slice(0, 3).forEach(p => console.log(`    ${p.slug} → ${p.titleEn}`));
    if (products.length > 3) console.log(`    ... and ${products.length - 3} more`);
  }
  
  console.log(`\n=== ACCESSORY SKU PREFIXES (${accessoryPrefixes.size}) ===`);
  console.log(`  ${[...accessoryPrefixes].sort().join(', ')}`);
  console.log(`  Total accessory SKUs: ${all.length - Object.values(prefixMap).reduce((s,a)=>s+a.length, 0)}`);
  console.log(`  Total vehicle kits: ${Object.values(prefixMap).reduce((s,a)=>s+a.length, 0)}`);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
