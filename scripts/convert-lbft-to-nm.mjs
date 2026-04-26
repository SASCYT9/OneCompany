// Convert lb-ft / фунт-фут torque values to Н·м (N·m) across all Burger Motorsports
// product descriptions and titles.
// Conversion: 1 lb-ft ≈ 1.3558 N·m
//
// Patterns covered:
//   "75 фунт-фут"          → "102 Н·м"
//   "75 фунт фут"          → "102 Н·м"
//   "75 ft-lb" / "75 ft-lbs" / "75 lb-ft" → "102 Nm"
//   "+100 lb-ft"           → "+136 Nm"
//   "75 wtq" (wheel tq lb-ft from JB4 ads) → "102 wtq (Н·м)"  (left as-is, just informative)

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

const LBFT_TO_NM = 1.3558;
function lbftToNm(lbft) {
  return Math.round(parseFloat(lbft) * LBFT_TO_NM);
}

function convertText(text, locale) {
  if (!text) return text;
  let t = text;

  // UA patterns
  if (locale === 'ua') {
    // "X фунт-фут" or "X фунт фут" or "X фунтів-фут" — sign before OR "+" after number ("15+" approx)
    t = t.replace(/([+−-]?)(\d+(?:[.,]\d+)?)(\+?)\s*фунт[іїоь]*[-\s]?фут[іов]*/gi, (_, sign, num, plus) => {
      const nm = lbftToNm(num.replace(',', '.'));
      return `${sign}${nm}${plus} Н·м`;
    });
  } else {
    t = t.replace(/([+−-]?)(\d+(?:\.\d+)?)(\+?)\s*(?:ft[\s-]?lbs?|lbs?[\s-]?ft|ftlbs?|lbft|tq[-\s]?lb)\b/gi, (_, sign, num, plus) => {
      const nm = lbftToNm(num);
      return `${sign}${nm}${plus} Nm`;
    });
  }

  return t;
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, titleEn: true, titleUa: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  console.log(`Processing ${products.length} burger products...`);

  let changed = 0, lbftFound = 0;
  for (const p of products) {
    const titleEn = convertText(p.titleEn, 'en');
    const titleUa = convertText(p.titleUa, 'ua');
    const bodyEn = convertText(p.bodyHtmlEn, 'en');
    const bodyUa = convertText(p.bodyHtmlUa, 'ua');

    const data = {};
    if (titleEn !== p.titleEn) data.titleEn = titleEn;
    if (titleUa !== p.titleUa) data.titleUa = titleUa;
    if (bodyEn !== p.bodyHtmlEn) data.bodyHtmlEn = bodyEn;
    if (bodyUa !== p.bodyHtmlUa) data.bodyHtmlUa = bodyUa;

    if (Object.keys(data).length > 0) {
      await prisma.shopProduct.update({ where: { id: p.id }, data });
      changed++;
    }

    // Count occurrences for stats
    if ((p.bodyHtmlEn || '').match(/ft[\s-]?lbs?|lbs?[\s-]?ft|ftlbs?/i)) lbftFound++;
    if ((p.bodyHtmlUa || '').match(/фунт[іїоь]*[-\s]?фут/i)) lbftFound++;
  }

  console.log(`\nProducts with lb-ft mentions: ${lbftFound}`);
  console.log(`Products updated:              ${changed}`);

  // Verify no remaining
  const remaining = await prisma.shopProduct.findMany({
    where: {
      brand: 'Burger Motorsports',
      OR: [
        { bodyHtmlEn: { contains: 'ft-lb' } },
        { bodyHtmlEn: { contains: 'lb-ft' } },
        { bodyHtmlUa: { contains: 'фунт-фут' } },
        { bodyHtmlUa: { contains: 'фунт фут' } },
      ],
    },
    select: { titleEn: true },
  });
  console.log(`\nRemaining lb-ft mentions: ${remaining.length}`);
  if (remaining.length > 0) {
    remaining.slice(0, 5).forEach((x) => console.log('  -', x.titleEn));
  }

  // Sample
  const sample = await prisma.shopProduct.findFirst({
    where: { brand: 'Burger Motorsports', titleEn: { contains: 'Group 11' } },
    select: { titleUa: true, bodyHtmlUa: true },
  });
  if (sample) {
    console.log('\n--- Sample after conversion ---');
    console.log(sample.titleUa);
    console.log(sample.bodyHtmlUa.slice(0, 400));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
