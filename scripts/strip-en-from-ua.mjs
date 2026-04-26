// Strip English sentences/paragraphs from Ukrainian product descriptions.
// Sentences with no Cyrillic characters and significant Latin chars are removed.

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

function isUkrainianSentence(text) {
  const cyrillicCount = (text.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  // If sentence has ANY Cyrillic, keep it (might be UA with Latin terms)
  if (cyrillicCount > 0) return true;
  // No Cyrillic and has many Latin = English-only
  if (latinCount > 5) return false;
  // Only numbers/punctuation/short = keep
  return true;
}

function stripEnglishFromUa(html) {
  if (!html) return html;
  // Process tag by tag — for <p> and <li>, check content; remove if EN-only
  return html.replace(/<(p|li|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
    // Strip nested HTML to get text
    const textOnly = content.replace(/<[^>]+>/g, ' ').trim();
    if (!textOnly) return match;
    // Check sentence-level for paragraphs
    if (tag === 'p') {
      const sentences = textOnly.match(/[^.!?]+[.!?]+/g) || [textOnly];
      const ukSentences = sentences.filter(isUkrainianSentence);
      // If no UA sentences, strip the paragraph
      if (ukSentences.length === 0) return '';
      // If some sentences are EN, rebuild paragraph with only UA
      if (ukSentences.length < sentences.length) {
        const cleaned = ukSentences.join(' ').trim();
        return `<${tag}${attrs}>${cleaned}</${tag}>`;
      }
    } else {
      // For li/headings: strip if entire content is EN-only
      if (!isUkrainianSentence(textOnly)) return '';
    }
    return match;
  });
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { not: '' } },
    select: { id: true, titleEn: true, bodyHtmlUa: true },
  });
  console.log(`Processing ${products.length} UA descriptions...`);

  let changed = 0;
  let removed = 0;

  for (const p of products) {
    const before = p.bodyHtmlUa.length;
    const cleaned = stripEnglishFromUa(p.bodyHtmlUa)
      .replace(/<p[^>]*>\s*<\/p>/g, '')
      .replace(/<li[^>]*>\s*<\/li>/g, '')
      .replace(/<ul[^>]*>\s*<\/ul>/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
    if (cleaned !== p.bodyHtmlUa) {
      await prisma.shopProduct.update({
        where: { id: p.id },
        data: { bodyHtmlUa: cleaned },
      });
      changed++;
      removed += before - cleaned.length;
    }
  }
  console.log(`\nChanged: ${changed}/${products.length}`);
  console.log(`Removed: ${removed.toLocaleString()} chars`);

  // Sample
  const sample = await prisma.shopProduct.findFirst({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { contains: '<h3>' } },
    select: { titleUa: true, bodyHtmlUa: true },
  });
  if (sample) {
    console.log('\n--- SAMPLE ---');
    console.log(sample.titleUa);
    console.log(sample.bodyHtmlUa.slice(0, 1500));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
