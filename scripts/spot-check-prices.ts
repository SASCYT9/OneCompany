import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const samples = ['BIG-310-T','BIG-310-Cr','BIG-450','ICM-500','ICM-400','LF-300-S-r','MK-180','LF-190-CF','LF-190-SAI-KIT','917056-5002S','898199-5001W','898200-5001W','ICM-380-S','TR-300-992','MK-100','MK-110'];
  console.log('SKU                      | DB € (current)     | Variant € (current)');
  console.log('─'.repeat(80));
  for (const sku of samples) {
    const r = await p.shopProduct.findFirst({ where: { sku: { equals: sku, mode: 'insensitive' } }, select: { sku: true, priceEur: true, variants: { select: { sku: true, priceEur: true } } } });
    if (r) {
      const v = r.variants.map(x => `${x.sku}=€${x.priceEur}`).join(', ');
      console.log(`  ${r.sku.padEnd(22)} | €${String(r.priceEur).padStart(10)}        | ${v}`);
    } else {
      console.log(`  ${sku.padEnd(22)} | (NOT FOUND)`);
    }
  }
  await p.$disconnect();
})();
