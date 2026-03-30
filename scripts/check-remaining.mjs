import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();
const all = await p.shopProduct.findMany({
  where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
  select: { bodyHtmlEn: true, titleEn: true },
});

const w = all.filter(x => /\$\d{2,}/.test(x.bodyHtmlEn));
console.log(`Remaining: ${w.length} with dollar mentions\n`);

for (const pr of w) {
  const matches = pr.bodyHtmlEn.match(/.{0,40}\$\d+.{0,40}/g) || [];
  console.log(`[${pr.titleEn.slice(0, 60)}]`);
  matches.forEach(m => console.log(`  >> "${m.trim()}"`));
  console.log('');
}

await p.$disconnect();
