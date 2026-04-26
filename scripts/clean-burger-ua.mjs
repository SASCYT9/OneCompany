// Clean Ukrainian burger descriptions — strip promo junk that survived
// from pre-cleanup EN translations.
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

const REMOVE = [
  // Dollar / price promos
  /[^.!?]*\$\d[\d,.]*[^.!?]*[.!?]?/g,
  /[^.!?]*[Зз]аощадж(уй|уйте|увати|и)\s+\$?\d[^.!?]*[.!?]?/g,
  /[^.!?]*[Зз]аощадь[^.!?]*[.!?]?/g,
  /[^.!?]*[Зз]нижк[аиу]\s+\$?\d[^.!?]*[.!?]?/g,
  /[^.!?]*[Ее]ксклюзивн[ау]\s+знижк[ау][^.!?]*[.!?]?/g,
  // Order now / Buy now
  /[^.!?]*[Зз]амовт?е\s+(зараз|сьогодні)[^.!?]*[.!?]?/g,
  /[^.!?]*[Кк]упуйте\s+(зараз|сьогодні)[^.!?]*[.!?]?/g,
  /[^.!?]*[Дд]одати\s+(в|до)\s+(кошик|корзин)[^.!?]*[.!?]?/g,
  /[^.!?]*[Нн]атисніть\s+тут[^.!?]*[.!?]?/g,
  // Free shipping
  /[^.!?]*[Бб]езкоштовн[ао]\s+достав[^.!?]*[.!?]?/g,
  /[^.!?]*[Дд]оставка\s+безкоштовн[^.!?]*[.!?]?/g,
  // URLs
  /https?:\/\/[^\s<)"]+/gi,
  /www\.[^\s<)"]+/gi,
  // Email
  /\S+@\S+\.\S+/g,
  // "Free Shipping" still in English
  /free shipping[^.!?]*[.!?]?/gi,
];

function clean(text) {
  if (!text) return text;
  let t = text;
  for (const rx of REMOVE) t = t.replace(rx, '');
  // Preserve HTML structure but tidy whitespace
  t = t.replace(/<p[^>]*>\s*<\/p>/g, '')
       .replace(/<h\d[^>]*>\s*<\/h\d>/g, '')
       .replace(/<strong[^>]*>\s*<\/strong>/g, '')
       .replace(/  +/g, ' ')
       .replace(/ ([.,!?])/g, '$1')
       .replace(/\.\s*\./g, '.')
       .replace(/\n{3,}/g, '\n\n')
       .trim();
  return t;
}

async function main() {
  const items = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { not: '' } },
    select: { id: true, titleEn: true, bodyHtmlUa: true },
  });
  let changed = 0;
  let totalRemoved = 0;
  for (const p of items) {
    const cleaned = clean(p.bodyHtmlUa);
    if (cleaned !== p.bodyHtmlUa) {
      totalRemoved += p.bodyHtmlUa.length - cleaned.length;
      await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlUa: cleaned } });
      changed++;
    }
  }
  console.log(`UA cleanup done. Changed: ${changed}/${items.length}, chars removed: ${totalRemoved.toLocaleString()}`);

  // Verify
  const after = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { bodyHtmlUa: true },
  });
  const checks = [
    ['$ prices', /\$\d{2,}/],
    ['Замовте зараз', /[Зз]амовт?е\s+зараз/],
    ['Знижка $', /[Зз]нижк[аиу]\s+\$/],
    ['Free Shipping', /free shipping/i],
    ['URLs', /https?:\/\//i],
  ];
  for (const [name, rx] of checks) {
    const c = after.filter(x => rx.test(x.bodyHtmlUa || '')).length;
    console.log(`  ${c === 0 ? '✅' : '⚠️'} ${name}: ${c}`);
  }
  await prisma.$disconnect();
}

main().catch(async err => { console.error(err); await prisma.$disconnect(); process.exit(1); });
