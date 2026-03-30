import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

async function run() {
  const all = await p.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { bodyHtmlEn: true, titleEn: true, productType: true },
  });
  
  const empty = await p.shopProduct.count({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: '' },
  });
  
  console.log(`Total with description: ${all.length}`);
  console.log(`Empty descriptions: ${empty}\n`);

  // Pattern detection
  const patterns = [
    ['Free Shipping', /free shipping/i],
    ['Save $XX', /save \$\d/i],
    ['Financing', /financing/i],
    ['Discount mentions', /discount/i],
    ['Coupon/Code', /coupon|promo\s*code/i],
    ['USA-only shipping', /in the usa|usa only|us only|shipping in usa/i],
    ['Install guide links', /install guide|installation guide/i],
    ['Warranty mentions', /warranty/i],
    ['Made in USA', /made in (the )?usa/i],
    ['Bundle/Package savings', /when you purchase|package.*save|save.*package/i],
    ['Kit includes list', /kit includes|package includes|includes:/i],
    ['BETA tag', /\(BETA\)/i],
    ['Locked ECU mention', /locked.*ecu|🔒/i],
    ['Phone/App mention', /free app|smartphone|phone/i],
    ['Forum/Community', /forum|community|facebook|group/i],
    ['YouTube/Video', /youtube|video/i],
    ['Price in dollars', /\$\d{2,}/],
    ['Competitor names', /cobb|dinan|mhd|bimmercode|bootmod/i],
    ['Contact info', /support@|@burger|\d{3}[-.]?\d{3}[-.]?\d{4}|contact us/i],
    ['External URLs', /https?:\/\/|www\.|burgertuning\.com/i],
    ['Buy now / Order now', /buy now|order now|add to cart/i],
    ['Shipping policy', /shipping policy|delivery time|business days/i],
    ['Vehicle fitment list', /vehicle fitment|application|compatible with/i],
    ['BMS brand mention', /\bBMS\b/],
    ['Fuel-It brand mention', /fuel-it/i],
  ];

  console.log('=== PATTERN FREQUENCY ===');
  for (const [name, rx] of patterns) {
    const count = all.filter(x => rx.test(x.bodyHtmlEn)).length;
    if (count > 0) {
      const pct = Math.round(count / all.length * 100);
      console.log(`  ${name}: ${count}/${all.length} (${pct}%)`);
    }
  }

  // Length distribution
  const lengths = all.map(x => x.bodyHtmlEn.length).sort((a, b) => a - b);
  console.log('\n=== LENGTH DISTRIBUTION ===');
  console.log(`  Min: ${lengths[0]}`);
  console.log(`  Max: ${lengths[lengths.length - 1]}`);
  console.log(`  Median: ${lengths[Math.floor(lengths.length / 2)]}`);
  console.log(`  Avg: ${Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)}`);
  console.log(`  <50 chars: ${lengths.filter(l => l < 50).length}`);
  console.log(`  50-200: ${lengths.filter(l => l >= 50 && l < 200).length}`);
  console.log(`  200-1000: ${lengths.filter(l => l >= 200 && l < 1000).length}`);
  console.log(`  1000-3000: ${lengths.filter(l => l >= 1000 && l < 3000).length}`);
  console.log(`  3000+: ${lengths.filter(l => l >= 3000).length}`);

  // Show short descriptions
  const short = all.filter(x => x.bodyHtmlEn.length < 100);
  if (short.length) {
    console.log(`\n=== VERY SHORT (<100 chars) — ${short.length} products ===`);
    short.forEach(x => console.log(`  [${x.productType}] "${x.bodyHtmlEn}"`));
  }

  // Show examples of problematic content
  console.log('\n=== EXAMPLE: Description with $ prices + shipping ===');
  const ex1 = all.find(x => /\$\d+/.test(x.bodyHtmlEn) && /free shipping/i.test(x.bodyHtmlEn));
  if (ex1) console.log(ex1.bodyHtmlEn.slice(0, 500));

  console.log('\n=== EXAMPLE: Description with URLs ===');
  const ex2 = all.find(x => /https?:\/\//.test(x.bodyHtmlEn));
  if (ex2) console.log(ex2.bodyHtmlEn.slice(0, 500));

  console.log('\n=== EXAMPLE: Description with bundle savings ===');
  const ex3 = all.find(x => /save.*\$\d+.*package/i.test(x.bodyHtmlEn) || /package.*save.*\$\d+/i.test(x.bodyHtmlEn));
  if (ex3) console.log(ex3.bodyHtmlEn.slice(0, 500));

  console.log('\n=== EXAMPLE: Description with competitor mention ===');
  const ex4 = all.find(x => /cobb|dinan|mhd/i.test(x.bodyHtmlEn));
  if (ex4) {
    console.log(`[${ex4.titleEn}]`);
    console.log(ex4.bodyHtmlEn.slice(0, 500));
  }

  await p.$disconnect();
}

run().catch(console.error);
