import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { sanitizeRichTextHtml } from '../src/lib/sanitizeRichTextHtml';
// Run with: npx tsx scripts/recover-burger-from-source.ts
//
// Resets bodyHtmlEn from data/burger-products.json descriptionEn (the source
// of truth for the Burger catalog) and clears bodyHtmlUa so the next translate
// run regenerates it. Use this when restructure passes have damaged the
// in-DB descriptions and we need to re-do the pipeline cleanly.
//
// Followed by:
//   node scripts/clean-burger-pre-translate.mjs     # strip junk from EN
//   node scripts/translate-burger-gemini.mjs        # EN→UA via Gemini
//   node scripts/restructure-burger-html.mjs        # build HTML structure

async function main() {
  const SRC = path.join(process.cwd(), 'data', 'burger-products.json');
  const products = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  console.log(`Source: ${products.length} products in JSON`);

  // Build slug → descriptionEn map (slug in DB has burger- prefix)
  const bySlug = new Map<string, string>();
  for (const p of products as Array<{ slug: string; descriptionEn?: string }>) {
    bySlug.set(`burger-${p.slug}`, p.descriptionEn || '');
  }

  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, slug: true, titleEn: true },
  });
  console.log(`DB: ${dbProducts.length} burger products`);

  let updated = 0;
  let missing = 0;
  for (const p of dbProducts) {
    const sourceEn = bySlug.get(p.slug);
    if (sourceEn === undefined) {
      missing++;
      continue;
    }
    await prisma.shopProduct.update({
      where: { id: p.id },
      data: {
        bodyHtmlEn: sanitizeRichTextHtml(sourceEn),
        bodyHtmlUa: '',
        titleUa: p.titleEn, // reset titleUa to titleEn so translate picks it up
      },
    });
    updated++;
    if (updated % 50 === 0) process.stdout.write(`\r  Reset: ${updated}...`);
  }

  console.log(`\n=== Done ===`);
  console.log(`Reset: ${updated}, Missing in JSON: ${missing}`);
  console.log('\nNext steps:');
  console.log('  node scripts/clean-burger-pre-translate.mjs');
  console.log('  node scripts/translate-burger-gemini.mjs --concurrency 8');
  console.log('  node scripts/restructure-burger-html.mjs');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
