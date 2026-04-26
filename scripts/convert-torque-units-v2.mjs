// Comprehensive torque unit conversion for Burger Motorsports products.
// All lb-ft variants → Н·м / Nm
// Conversion: 1 lb-ft = 1.3558 N·m
//
// Patterns:
//   "75 wtq" / "75wtq"     → "102 Н·м (на колесах)" (wheel torque, lb-ft)
//   "75 TQ" / "75tq"       → "102 Н·м" (torque, lb-ft)
//   "75 ft-lbs" / "75 lb-ft" / "75 lb·ft" → Nm
//   "75 фунт-фут"          → "102 Н·м"
//   "120 lb-ft"            → "163 Nm"
//
// Note: hp / whp are NOT torque — leave alone.

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

const LBFT_TO_NM = 1.3558;
function toNm(lbft) {
  return Math.round(parseFloat(lbft) * LBFT_TO_NM);
}

function convertText(text, locale) {
  if (!text) return text;
  let t = text;
  const nmLabel = locale === 'ua' ? 'Н·м' : 'Nm';

  // 1. "wtq" (wheel torque) — most common in JB4 product descriptions
  // e.g. "30wtq" or "30 wtq" or "+30 wtq"
  t = t.replace(/([+−-]?)(\d+(?:\.\d+)?)(\+?)\s*wtq\b/gi, (_, sign, num, plus) => {
    const nm = toNm(num);
    return locale === 'ua' ? `${sign}${nm}${plus} ${nmLabel} (на колесах)` : `${sign}${nm}${plus} ${nmLabel} (wheel)`;
  });

  // 2. "tq" alone (torque, typically lb-ft in JB4 marketing)
  // e.g. "10TQ" or "75 tq" — must NOT match "wtq" (handled above)
  t = t.replace(/([+−-]?)(\d+(?:\.\d+)?)(\+?)\s*(?<!w)tq\b/gi, (_, sign, num, plus) => {
    const nm = toNm(num);
    return `${sign}${nm}${plus} ${nmLabel}`;
  });

  // 3. ft-lb / ft-lbs / ft·lb / ftlb / lb-ft / lbft variants
  t = t.replace(/([+−-]?)(\d+(?:\.\d+)?)(\+?)\s*(?:ft[\s\-·.]?lbs?|lbs?[\s\-·.]?ft|ftlbs?|lbft)\b/gi, (_, sign, num, plus) => {
    const nm = toNm(num);
    return `${sign}${nm}${plus} ${nmLabel}`;
  });

  // 4. "X lb-ft" with space (rare but possible)
  t = t.replace(/([+−-]?)(\d+(?:\.\d+)?)(\+?)\s+lb\s+ft\b/gi, (_, sign, num, plus) => {
    const nm = toNm(num);
    return `${sign}${nm}${plus} ${nmLabel}`;
  });

  // 5. UA "фунт-фут" patterns (already done before but repeat for safety)
  if (locale === 'ua') {
    t = t.replace(/([+−-]?)(\d+(?:[.,]\d+)?)(\+?)\s*фунт[іїоь]*[-\s]?фут[іов]*/gi, (_, sign, num, plus) => {
      const nm = toNm(num.replace(',', '.'));
      return `${sign}${nm}${plus} Н·м`;
    });
  }

  // 6. "pound-feet" / "foot-pounds" full words
  t = t.replace(/([+−-]?)(\d+(?:\.\d+)?)(\+?)\s*(?:pound[\s-]?feet|foot[\s-]?pounds)/gi, (_, sign, num, plus) => {
    const nm = toNm(num);
    return `${sign}${nm}${plus} ${nmLabel}`;
  });

  return t;
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, titleEn: true, titleUa: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  console.log(`Processing ${products.length} burger products...`);

  let changed = 0;
  let conversionExamples = [];

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
      if (conversionExamples.length < 5 && bodyUa !== p.bodyHtmlUa) {
        const oldMatch = (p.bodyHtmlUa || '').match(/.{0,30}(?:wtq|tq|фунт-фут).{0,30}/i);
        const newMatch = bodyUa.match(/.{0,30}(?:Н·м).{0,30}/i);
        if (oldMatch && newMatch) {
          conversionExamples.push({ title: p.titleEn, before: oldMatch[0], after: newMatch[0] });
        }
      }
    }
  }

  console.log(`\nUpdated: ${changed} products`);

  // Verify
  const remaining = await prisma.shopProduct.findMany({
    where: {
      brand: 'Burger Motorsports',
      OR: [
        { bodyHtmlEn: { contains: 'wtq' } },
        { bodyHtmlEn: { contains: 'lb-ft' } },
        { bodyHtmlEn: { contains: 'ft-lb' } },
        { bodyHtmlUa: { contains: 'wtq' } },
        { bodyHtmlUa: { contains: 'фунт-фут' } },
      ],
    },
    select: { titleEn: true, bodyHtmlUa: true },
  });
  console.log(`Remaining: ${remaining.length}`);
  if (remaining.length) {
    remaining.slice(0, 3).forEach((x) => {
      const m = (x.bodyHtmlUa||'').match(/.{0,40}(?:wtq|lb-ft|ft-lb|фунт-фут).{0,40}/i);
      console.log(`  - ${x.titleEn}: "${m ? m[0] : ''}"`);
    });
  }

  console.log('\n--- Examples ---');
  for (const ex of conversionExamples) {
    console.log(`${ex.title}`);
    console.log(`  Before: "${ex.before.replace(/\s+/g, ' ')}"`);
    console.log(`  After:  "${ex.after.replace(/\s+/g, ' ')}"`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
