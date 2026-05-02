import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

async function main() {
  const rows = await p.shopProduct.findMany({
    where: {
      isPublished: true,
      OR: [
        { brand: { contains: 'adro', mode: 'insensitive' } },
        { vendor: { contains: 'adro', mode: 'insensitive' } },
        { slug: { startsWith: 'adro-' } },
      ],
    },
    select: { slug: true, sku: true, titleEn: true, titleUa: true },
    orderBy: { sku: 'asc' },
  });

  console.log(`Total Adro rows: ${rows.length}\n`);

  // Group by SKU suffix to spot -40 / -50 pattern
  const ending = (sku: string | null) => {
    if (!sku) return '(no-sku)';
    const m = sku.match(/-?(\d{2,3})$/);
    return m ? m[1] : '(other)';
  };

  const buckets = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = ending(r.sku);
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }

  console.log('--- SKU-suffix distribution ---');
  for (const [k, v] of [...buckets.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  -${k.padStart(3)}  ×  ${v.length}`);
  }

  console.log('\n--- All SKUs ending in -40 (per user: should be M3) ---');
  for (const r of rows) {
    if (r.sku && /-?40$/.test(r.sku)) {
      console.log(`  SKU=${r.sku.padEnd(20)} slug=${r.slug}`);
      console.log(`    EN: ${r.titleEn ?? ''}`);
      console.log(`    UA: ${r.titleUa ?? ''}`);
    }
  }

  console.log('\n--- All SKUs ending in -50 (per user: should be M4) ---');
  for (const r of rows) {
    if (r.sku && /-?50$/.test(r.sku)) {
      console.log(`  SKU=${r.sku.padEnd(20)} slug=${r.slug}`);
      console.log(`    EN: ${r.titleEn ?? ''}`);
      console.log(`    UA: ${r.titleUa ?? ''}`);
    }
  }

  // Sanity: any other M3/M4 BMW SKUs?
  console.log('\n--- All Adro SKUs containing BMW M3 or M4 in title ---');
  for (const r of rows) {
    const t = r.titleEn ?? '';
    if (/\b(M3|M4)\b/i.test(t) || /BMW/i.test(t)) {
      console.log(`  SKU=${(r.sku ?? '').padEnd(20)}  ${t}`);
    }
  }

  await p.$disconnect();
}
main().catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
