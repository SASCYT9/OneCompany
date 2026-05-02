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
    select: { sku: true, slug: true, titleEn: true, titleUa: true },
    orderBy: { sku: 'asc' },
  });

  // 1) Rows whose SKU does NOT match A14<block>-<part> shape.
  console.log('=== Non-standard Adro SKUs ===');
  const nonStd = rows.filter((r) => {
    if (!r.sku) return true;
    const head = r.sku.split('/')[0].trim();
    return !/^A1[0-9][A-Z]+\d+-\d+/.test(head);
  });
  for (const r of nonStd) console.log(`  SKU=${(r.sku ?? '(none)').padEnd(30)}  ${r.titleEn ?? r.titleUa ?? ''}`);

  // 2) For each non-BMW make (Porsche, Toyota, Tesla, Subaru, Honda, Ford, ...),
  //    list rows that mention multiple distinct *vehicle* names in the title —
  //    those are the equivalent of M3+M4 bundles for other brands.
  console.log('\n=== Non-BMW Adro rows that bundle multiple model names ===');
  const VEH_PATTERNS = [
    { make: 'Porsche', re: /\b(?:911 GT3 RS|911 GT3|911|718|Cayman|Boxster|Macan|Cayenne|Panamera|Taycan)\b/g },
    { make: 'Toyota', re: /\b(?:GR86|GR Yaris|Yaris|Supra|GR Supra)\b/g },
    { make: 'Subaru', re: /\b(?:BRZ|WRX|STI)\b/g },
    { make: 'Tesla', re: /\b(?:Model 3|Model Y|Model S|Model X)\b/g },
    { make: 'Honda', re: /\b(?:Civic Type R|Civic|FL5|FK8)\b/g },
    { make: 'Ford', re: /\b(?:Mustang)\b/g },
    { make: 'Hyundai', re: /\b(?:Elantra N|Elantra|Veloster|Kona N|i30 N)\b/g },
    { make: 'Genesis', re: /\b(?:G70|GV70|GV80)\b/g },
    { make: 'Kia', re: /\b(?:Stinger|EV6)\b/g },
    { make: 'Chevrolet', re: /\b(?:Corvette|C8|Camaro)\b/g },
  ];
  for (const r of rows) {
    const t = r.titleEn ?? '';
    if (/\bBMW\b/i.test(t)) continue;
    for (const v of VEH_PATTERNS) {
      const matches = [...new Set(t.match(v.re) ?? [])];
      if (matches.length >= 2) {
        console.log(`  ${(r.sku ?? '').padEnd(20)}  ${v.make.padEnd(10)} -> [${matches.join(', ')}]`);
        console.log(`    EN: ${t}`);
        console.log(`    UA: ${r.titleUa ?? ''}`);
      }
    }
  }

  // 3) Rows with chassis codes that look mismatched: e.g. an M3 row with G82 chassis,
  //    or a 911 row with 992 (fine) vs 991 (also fine) — focus on weird combos.
  console.log('\n=== BMW rows with weird chassis bundles (4+ distinct chassis) ===');
  for (const r of rows) {
    const t = r.titleEn ?? '';
    if (!/\bBMW\b/i.test(t)) continue;
    const chassis = [...new Set((t.match(/\b[EFGH]\d{2,3}\b/g) ?? []))];
    if (chassis.length >= 4) {
      console.log(`  SKU=${(r.sku ?? '').padEnd(20)} chassis=[${chassis.join(',')}]`);
      console.log(`    EN: ${t}`);
    }
  }

  await p.$disconnect();
}
main().catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
