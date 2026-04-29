import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
// Run with: npx tsx scripts/tag-burger-non-jb4-price-review.ts
//
// Marks all non-JB4-family Burger products with tag `price-needs-review`
// so we can find and re-price them later (per-product manual review).
//
// JB4 family = jb4-tuners, jb-plus-tuners, stage-1-tuners (these stay priced
// via the standard formula original × 1.10 + $30). Everything else needs a
// human pass since the parser intent was "Price on Request" but JSON now
// has marked-up prices for them too — we keep showing those provisional
// prices but flag them for review.

const JB4_TYPES = new Set(['type:jb4-tuners', 'type:jb-plus-tuners', 'type:stage-1-tuners']);
const REVIEW_TAG = 'price-needs-review';

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, slug: true, tags: true, priceUsd: true },
  });
  console.log(`Total Burger products: ${products.length}`);

  let tagged = 0;
  let alreadyTagged = 0;
  let jb4Skipped = 0;
  let nullPrice = 0;

  for (const p of products) {
    const isJb4 = (p.tags || []).some((t) => JB4_TYPES.has(t));
    if (isJb4) {
      jb4Skipped++;
      continue;
    }
    if (p.priceUsd == null) {
      // Already on "Price on Request" — no review needed for that case
      nullPrice++;
      continue;
    }
    if ((p.tags || []).includes(REVIEW_TAG)) {
      alreadyTagged++;
      continue;
    }
    const newTags = [...new Set([...(p.tags || []), REVIEW_TAG])];
    await prisma.shopProduct.update({
      where: { id: p.id },
      data: { tags: newTags },
    });
    tagged++;
    if (tagged % 25 === 0) process.stdout.write(`\r  Tagged ${tagged}...`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Tagged (new):        ${tagged}`);
  console.log(`Already tagged:      ${alreadyTagged}`);
  console.log(`JB4-family skipped:  ${jb4Skipped}`);
  console.log(`Null priceUsd skipped: ${nullPrice}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
