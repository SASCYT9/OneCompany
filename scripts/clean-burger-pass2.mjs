import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

// Second pass patterns — more aggressive
const PATTERNS = [
  // "Save $100.00 When purchased with this manifold"
  /Save \$[\d,.]+\s*(when|if)\s+purchased[^.!]*[.!]?/gi,
  // "save $$$"
  /save \$+[^.!]*[.!]?/gi,
  // "$80 discount available if purchased"
  /\$[\d,.]+\s*discount\s*(available\s*)?(if|when)[^.!]*[.!]?/gi,
  // "(Add $75.00)" — addon pricing
  /\(Add \$[\d,.]+\)/gi,
  // "($100 savings!)"
  /\(\$[\d,.]+\s*savings?!?\)/gi,
  // "FREE ($99 Value)"
  /FREE \(\$[\d,.]+\s*Value\)/gi,
  // "($60.00 Value)"
  /\(\$[\d,.]+\s*Value\)/gi,
  // "All sales final" 
  /all sales final[^.!]*[.!]?/gi,
  // Leftover "Free Shipping" hidden in weird positions
  /free shipping[^.!]*[.!]?/gi,
];

async function run() {
  const products = await p.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { id: true, bodyHtmlEn: true, titleEn: true },
  });

  let changed = 0;
  for (const pr of products) {
    let text = pr.bodyHtmlEn;
    let original = text;

    for (const rx of PATTERNS) {
      text = text.replace(rx, '');
    }

    // Cleanup
    text = text.replace(/  +/g, ' ').replace(/\.\s*\./g, '.').trim();

    if (text !== original) {
      await p.shopProduct.update({ where: { id: pr.id }, data: { bodyHtmlEn: text } });
      changed++;
    }
  }

  console.log(`Second pass: ${changed} descriptions updated`);

  // Verify
  const after = await p.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { bodyHtmlEn: true },
  });

  const checks = [
    ['Save $', /save \$/i],
    ['Dollar $XX', /\$\d{2,}/],
    ['Free Shipping', /free shipping/i],
    ['Discount', /discount (available|if|when)/i],
  ];

  for (const [name, rx] of checks) {
    const count = after.filter(x => rx.test(x.bodyHtmlEn)).length;
    console.log(`  ${count === 0 ? '✅' : '⚠️'} ${name}: ${count}`);
  }

  await p.$disconnect();
}

run().catch(console.error);
