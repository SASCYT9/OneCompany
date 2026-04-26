// Round 3 polish: remove EN paragraphs/sentences inside UA bodies and trim doubled whitespace.

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

function isPredominantlyEnglish(text) {
  const stripped = text.replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, '');
  const cyrillic = (stripped.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || []).length;
  const latin = (stripped.match(/[a-zA-Z]/g) || []).length;
  if (cyrillic + latin < 30) return false;
  return latin > cyrillic * 2; // >2x more Latin than Cyrillic = likely EN
}

function cleanUaBody(html) {
  if (!html) return html;
  let t = html;

  // 1. Remove <p> blocks where content is predominantly English
  t = t.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (match, inner) => {
    const textOnly = inner.replace(/<[^>]+>/g, '').trim();
    if (textOnly.length > 30 && isPredominantlyEnglish(textOnly)) {
      return ''; // remove EN paragraph
    }
    return match;
  });

  // 2. Remove <li> items that are predominantly EN
  t = t.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (match, inner) => {
    const textOnly = inner.replace(/<[^>]+>/g, '').trim();
    if (textOnly.length > 20 && isPredominantlyEnglish(textOnly)) return '';
    return match;
  });

  // 3. Collapse multiple consecutive spaces
  t = t.replace(/  +/g, ' ');
  // Collapse spaces immediately after opening tag or before closing tag
  t = t.replace(/(<[a-z]+[^>]*>)\s{2,}/g, '$1 ').replace(/\s{2,}(<\/[a-z]+>)/g, ' $1');
  // Trim leading/trailing whitespace inside tags
  t = t.replace(/<(p|li|h[1-6])([^>]*)>\s+/g, '<$1$2>').replace(/\s+<\/(p|li|h[1-6])>/g, '</$1>');
  // Remove empty tags after stripping
  t = t.replace(/<p[^>]*>\s*<\/p>/g, '')
       .replace(/<li[^>]*>\s*<\/li>/g, '')
       .replace(/<ul[^>]*>\s*<\/ul>/g, '')
       .replace(/<h3[^>]*>\s*<\/h3>/g, '');
  // Trim doubled newlines
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { not: '' } },
    select: { id: true, titleEn: true, bodyHtmlUa: true },
  });
  console.log(`Processing ${products.length} UA descriptions...`);

  let changed = 0;
  let removedChars = 0;
  for (const p of products) {
    const cleaned = cleanUaBody(p.bodyHtmlUa);
    if (cleaned !== p.bodyHtmlUa) {
      removedChars += p.bodyHtmlUa.length - cleaned.length;
      await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlUa: cleaned } });
      changed++;
    }
  }
  console.log(`Changed: ${changed}, removed ${removedChars.toLocaleString()} chars`);
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
