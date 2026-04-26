// Pass 3: strip sentences containing $XX promo/refund/credit content
// and refund-offer/JB+-credit blocks that survived earlier passes.

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

function clean(text) {
  if (!text) return text;
  let out = text;

  // Remove sentences containing $XX (any dollar amount)
  out = out.replace(/[^.!?]*\$\d[\d,.]*[^.!?]*[.!?]?/g, '');

  // Specific JB+/JB4 credit-back offer blocks
  out = out.replace(/Receive (?:a )?\$?\d+(?:\.\d+)? (?:USD )?(?:back|credit|refund|core refund)[^.!?]*[.!?]?/gi, '');
  out = out.replace(/(?:If|When) you (?:upgrade|return|trade|exchange)[^.!?]*\$\d[^.!?]*[.!?]?/gi, '');
  out = out.replace(/(?:Save|Get) up to \$?\d+[^.!?]*[.!?]?/gi, '');

  // Cleanup whitespace artifacts
  out = out.replace(/  +/g, ' ').replace(/ ([.,!?])/g, '$1').replace(/\.\s*\./g, '.').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { id: true, titleEn: true, bodyHtmlEn: true },
  });
  let changed = 0;
  for (const p of products) {
    const cleaned = clean(p.bodyHtmlEn);
    if (cleaned !== p.bodyHtmlEn) {
      await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlEn: cleaned } });
      changed++;
    }
  }
  console.log(`Pass 3 done. Changed: ${changed}`);

  // Verify
  const after = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { contains: '$' } },
    select: { titleEn: true, bodyHtmlEn: true },
  });
  const remaining = after.filter(x => /\$\d{2,}/.test(x.bodyHtmlEn));
  console.log(`Remaining $ prices: ${remaining.length}`);
  await prisma.$disconnect();
}

main().catch(async err => { console.error(err); await prisma.$disconnect(); process.exit(1); });
