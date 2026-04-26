// Round 4: aggressive per-sentence English stripping in UA descriptions
// Plus: translate EN section headings to UA, fix sentence-fragments

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

function isUkrainianSentence(text) {
  const stripped = text.trim();
  if (stripped.length < 5) return true; // short fragments keep
  const cyrillic = (stripped.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || []).length;
  const latin = (stripped.match(/[a-zA-Z]/g) || []).length;
  // Has Cyrillic AND Cyrillic >= Latin → keep (UA with embedded EN terms is fine)
  if (cyrillic >= latin) return true;
  // No Cyrillic and significant Latin → drop
  if (cyrillic === 0 && latin > 5) return false;
  // Some Cyrillic but Latin dominates → drop (likely EN with one transliterated word)
  if (latin > cyrillic * 1.2) return false;
  return true;
}

// Translate common EN section headings to UA
function translateHeadings(html) {
  return html
    .replace(/<h3[^>]*>\s*Features?(?:\s+(?:and|&)\s+Benefits?)?\s*<\/h3>/gi, '<h3>Особливості</h3>')
    .replace(/<h3[^>]*>\s*Vehicle\s+Fitment\s*<\/h3>/gi, '<h3>Сумісність</h3>')
    .replace(/<h3[^>]*>\s*Compatible\s+(?:with|vehicles?)\s*<\/h3>/gi, '<h3>Сумісність</h3>')
    .replace(/<h3[^>]*>\s*Specifications?\s*<\/h3>/gi, '<h3>Технічні характеристики</h3>')
    .replace(/<h3[^>]*>\s*What\s*['']?s\s+Included\s*<\/h3>/gi, '<h3>Комплектація</h3>')
    .replace(/<h3[^>]*>\s*Includes?\s*<\/h3>/gi, '<h3>Комплектація</h3>')
    .replace(/<h3[^>]*>\s*Package\s+Contents?\s*<\/h3>/gi, '<h3>Комплектація</h3>')
    .replace(/<h3[^>]*>\s*Installation\s*<\/h3>/gi, '<h3>Встановлення</h3>')
    .replace(/<h3[^>]*>\s*Benefits?\s*<\/h3>/gi, '<h3>Переваги</h3>');
}

// Split HTML into sentence-bearing nodes (p, li) and process each
function processNode(html) {
  // For each <p>, <li>: split content into sentences, drop EN, rejoin
  return html.replace(/<(p|li|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
    // Strip nested simple tags briefly to get text
    if (tag.startsWith('h')) return match; // headings handled separately

    // Get sentences from text, considering inline tags (<strong>, <em>, etc.)
    const innerText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!innerText || innerText.length < 5) return match;

    // Split on sentence boundary (UA-aware: . ! ? followed by space + capital letter)
    // Protect "к.с.", "т.д.", etc.
    const protectedText = innerText
      .replace(/к\.\s?с\./g, '⟦HP⟧')
      .replace(/т\.\s?д\./g, '⟦TD⟧')
      .replace(/E\.g\./g, '⟦EG⟧')
      .replace(/i\.e\./g, '⟦IE⟧');
    const sentences = protectedText.split(/(?<=[.!?])\s+(?=[A-ZА-ЯІЇЄҐ\d•])/);
    const ukSentences = sentences
      .map((s) => s.replace(/⟦HP⟧/g, 'к.с.').replace(/⟦TD⟧/g, 'т.д.').replace(/⟦EG⟧/g, 'e.g.').replace(/⟦IE⟧/g, 'i.e.'))
      .filter(isUkrainianSentence)
      .map((s) => s.trim().replace(/^[,;:]+\s*/, '').replace(/[,;:]+\s*$/, ''))
      .filter((s) => s.length > 3);

    if (ukSentences.length === 0) return ''; // entire block was EN
    const joined = ukSentences.join(' ').trim();
    return `<${tag}${attrs}>${joined}</${tag}>`;
  });
}

function cleanUaBody(html) {
  if (!html) return html;
  let t = html;
  t = translateHeadings(t);
  t = processNode(t);
  // Cleanup empty / orphaned tags
  t = t.replace(/<p[^>]*>\s*<\/p>/g, '')
       .replace(/<li[^>]*>\s*<\/li>/g, '')
       .replace(/<ul[^>]*>\s*<\/ul>/g, '')
       .replace(/<h3[^>]*>\s*<\/h3>/g, '');
  // Orphaned <h3> followed by no list/paragraph
  t = t.replace(/<h3[^>]*>[\s\S]*?<\/h3>(?=\s*<h3>|\s*$)/g, '');
  // Final whitespace
  t = t.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim();
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

  // Check
  const after = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { not: '' } },
    select: { titleEn: true, bodyHtmlUa: true },
  });
  let withEnglish = 0;
  for (const x of after) {
    if (/\b(?:the|with|and|for|when|will|that|this|your|our)\s+[a-z]+/i.test(x.bodyHtmlUa)) withEnglish++;
  }
  console.log(`UA descriptions with EN sentences remaining: ${withEnglish}`);

  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
