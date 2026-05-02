import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const eu: Array<{sku:string;priceEur:number}> = JSON.parse(fs.readFileSync('scripts/do88/scraped/do88-eu-prices.json','utf-8'));
const euMap = new Map<string,{sku:string;priceEur:number}>();
for (const p of eu) {
  euMap.set(p.sku, p);
  euMap.set(p.sku.toLowerCase(), p);
}
const find = (sku: string) => {
  if (!sku) return null;
  const candidates = [
    sku, sku.toLowerCase(), sku.toUpperCase(),
    sku.replace(/^do88-/i,''), sku.replace(/^do88-/i,'').toLowerCase(),
    sku.replace(/^do88-/i,'').toUpperCase(),
  ];
  for (const c of candidates) { const f = euMap.get(c); if (f) return f; }
  return null;
};
(async () => {
  const prisma = new PrismaClient();
  const dbProducts = await prisma.shopProduct.findMany({
    where:{ brand:{ equals:'DO88', mode:'insensitive' } },
    select:{ sku:true, priceEur:true, slug:true }
  });
  let matched = 0, unmatched = 0;
  const unmatchedList: any[] = [];
  for (const p of dbProducts) {
    if (find(p.sku ?? '')) matched++;
    else { unmatched++; if (unmatchedList.length < 10) unmatchedList.push(p); }
  }
  console.log('DB total:', dbProducts.length);
  console.log('matched in EU scrape:', matched);
  console.log('unmatched:', unmatched);
  console.log('\nFirst 10 unmatched:');
  unmatchedList.forEach(p => console.log(' ', p.sku, p.slug));
  await prisma.$disconnect();
})();
