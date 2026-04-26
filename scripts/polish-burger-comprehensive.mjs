// Comprehensive Burger description polish:
// 1. Remove leftover "Часто імітований" / "Often imitated" promo
// 2. Remove "Click here / НАТИСНІТЬ ТУТ" calls
// 3. Remove email addresses & phone numbers
// 4. Remove California/EPA/CARB compliance text (irrelevant for UA market)
// 5. Convert mph → км/год (× 1.609)
// 6. Convert "0-60 mph" → "0-100 км/год" (industry-standard substitute)
// 7. Convert gallons → литри (× 3.785)
// 8. Convert fluid oz → мл (× 29.57)
// 9. Remove residual "Save X%" or promo phrases
// 10. Inch sizes → mm where context suggests pipe diameter

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

// Strip these full sentences/phrases
const STRIP_PATTERNS = [
  // Often imitated promo block (UA + EN) — handles truncated and full forms
  /[Чч]асто імітован[іий]+,?\s+але ніколи не (?:дубльован[оі]|скопійован[оі])[\s\S]{0,500}?(?:(?:світу|країнах\s+світу)\.?|<\/[a-z]+>)/gi,
  /[Чч]асто імітований[^<]{0,40}?(?:<\/(?:p|li)>|$)/gi,  // truncated remnants
  /Often imitated[^<]{20,500}?(?:world|countries)\.?/gi,
  /JB4 (?:був|є) золотим стандартом[^<]{0,400}?\./gi,
  /JB4 has been the gold standard[^<]{0,400}?\./gi,
  // California/CARB compliance text (irrelevant for UA market)
  /[^<.]{0,80}(?:not legal|not available)[^.]*California[^.]*\.?/gi,
  /[^<.]{0,80}California[^.]*?(?:emissions|legal)[^.]*\.?/gi,
  /[Сс]ертифіковано CARB[^<.]{0,200}/gi,
  /CARB EO[^.]*\./gi,
  /[Зз]годно з нормам[аи][^<.]*?CARB[^<.]{0,200}/gi,
  /<li>[^<]*(?:CARB|California|EPA)[^<]*<\/li>/gi,
  // CARB / EPA / California text
  /[Цц]ей продукт[^.]*(?:CARB|EPA|California)[^.]*\./g,
  /This product (?:is not|does not|may)[^.]*(?:CARB|EPA|California)[^.]*\./g,
  /CARB EO[^.]*\./gi,
  /(?:WARNING|УВАГА): California[^.]*\./gi,
  /[^.]*(?:CARB|EPA)\s+(?:certified|compliant|approved|legal)[^.]*\./gi,
  /[^.]*Pursuant to California[^.]*\./gi,
  // Click here / Натисніть тут (case-insensitive, mid-text or end)
  /[Нн][АА]ТИСНІТЬ ТУТ[^.<]{0,100}/gi,
  /[Нн]атисніть тут[^.<]{0,100}/gi,
  /[Кк]лацніть тут[^.<]{0,100}/gi,
  /[Cc]lick here[^.<]{0,100}/gi,
  // Save X% promos
  /\b[Ss]ave\s+\d+%[^.]*\./gi,
  /[Зз]аощадь\s+\d+%[^.]*\./gi,
  // Promo bundle savings
  /\b(?:save|when purchased together|coupon|promo code)[\s\S]{0,80}?\./gi,
  // Email addresses (and surrounding sentence)
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // Phone numbers (US format)
  /\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  /\b(?:call|зателефонуй)\s+(?:us|now|today|нам)[^.]*\./gi,
  // Install / demo video links
  /Install Video:?\s*\.?/gi,
  /Демонстраційне відео:?\s*\.?/gi,
];

// Unit conversions
function convertUnits(text, locale) {
  if (!text) return text;
  let t = text;

  // 1. mph → км/год (if not part of "mp" word)
  t = t.replace(/(\d+(?:\.\d+)?)\s*mph\b/gi, (_, n) => {
    const kmh = Math.round(parseFloat(n) * 1.609);
    return locale === 'ua' ? `${kmh} км/год` : `${kmh} km/h`;
  });
  t = t.replace(/(\d+(?:\.\d+)?)\s*миль\/год/gi, (_, n) => {
    const kmh = Math.round(parseFloat(n) * 1.609);
    return `${kmh} км/год`;
  });
  // "0-60 mph" → "0-100 км/год" (Ukrainian/European standard)
  t = t.replace(/0[\s-]+60\s*(?:mph|миль\/год)/gi, locale === 'ua' ? '0-100 км/год' : '0-100 km/h');

  // 2. gallons → літри (1 gal ≈ 3.785 L)
  t = t.replace(/(\d+(?:\.\d+)?)\s*[Gg]allon[s]?/g, (_, n) => {
    const liters = (parseFloat(n) * 3.785).toFixed(1).replace(/\.0$/, '');
    return locale === 'ua' ? `${liters} л` : `${liters} L`;
  });
  t = t.replace(/(\d+(?:\.\d+)?)\s*галон[іва]*/gi, (_, n) => {
    const liters = (parseFloat(n) * 3.785).toFixed(1).replace(/\.0$/, '');
    return `${liters} л`;
  });

  // 3. fl oz → мл (1 fl oz = 29.57 mL); leave plain "oz" alone (could be weight)
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s?oz|fluid ounces?)/gi, (_, n) => {
    const ml = Math.round(parseFloat(n) * 29.57);
    return locale === 'ua' ? `${ml} мл` : `${ml} mL`;
  });
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:рідк|рідкі)?\s?унц[іїяь]+/gi, (_, n) => {
    const ml = Math.round(parseFloat(n) * 29.57);
    return `${ml} мл`;
  });

  // 4. inch pipe sizes (e.g. "3.5\"" or "3.5 inch" → "89 мм")
  // Only convert when followed by pipe-related context to avoid breaking other inches
  // Skip for safety — leave inches as is

  return t;
}

function cleanText(text, locale) {
  if (!text) return text;
  let t = text;
  for (const rx of STRIP_PATTERNS) t = t.replace(rx, '');
  t = convertUnits(t, locale);
  // Cleanup empty tags & whitespace
  t = t.replace(/<p[^>]*>\s*<\/p>/g, '')
       .replace(/<li[^>]*>\s*<\/li>/g, '')
       .replace(/<ul[^>]*>\s*<\/ul>/g, '')
       .replace(/  +/g, ' ')
       .replace(/ ([.,;:])/g, '$1')
       .replace(/\.{2,}/g, '.')
       .trim();
  return t;
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, titleEn: true, titleUa: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  console.log(`Processing ${products.length} burger products...`);

  let changed = 0;
  for (const p of products) {
    const titleEn = cleanText(p.titleEn, 'en');
    const titleUa = cleanText(p.titleUa, 'ua');
    const bodyEn = cleanText(p.bodyHtmlEn, 'en');
    const bodyUa = cleanText(p.bodyHtmlUa, 'ua');

    const data = {};
    if (titleEn !== p.titleEn) data.titleEn = titleEn;
    if (titleUa !== p.titleUa) data.titleUa = titleUa;
    if (bodyEn !== p.bodyHtmlEn) data.bodyHtmlEn = bodyEn;
    if (bodyUa !== p.bodyHtmlUa) data.bodyHtmlUa = bodyUa;

    if (Object.keys(data).length > 0) {
      await prisma.shopProduct.update({ where: { id: p.id }, data });
      changed++;
    }
  }
  console.log(`Changed: ${changed}`);

  // Verify
  const checks = [
    ['Часто імітований', /часто імітован/i],
    ['Often imitated', /often imitated/i],
    ['Click here / Натисніть тут', /click here|натисніть тут/i],
    ['Email addresses', /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i],
    ['Save X%', /save \d+%|заощадь \d+%/i],
    ['mph', /\b\d+\s*mph\b/i],
    ['миль/год', /миль\/год/i],
    ['gallons', /\b\d+\s*gallon/i],
    ['галонів', /\d+\s*галон/i],
    ['CARB / EPA / California', /\b(?:CARB|EPA|California)\b(?!.*[Ну·]м)/],
  ];

  const allItems = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { titleEn: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  console.log('\nVerification:');
  for (const [name, rx] of checks) {
    let count = 0;
    for (const x of allItems) {
      const text = `${x.titleEn||''} ${x.bodyHtmlEn||''} ${x.bodyHtmlUa||''}`;
      if (rx.test(text)) count++;
    }
    console.log(`  ${count === 0 ? '✅' : '⚠️'} ${name.padEnd(35)}: ${count}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
