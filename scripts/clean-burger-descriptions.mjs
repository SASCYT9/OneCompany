/**
 * Clean Burger Motorsports product descriptions
 * Removes: USA shipping, $ prices, financing, discounts, URLs, contact info, CTAs
 * Keeps: technical specs, fitment, power gains, kit contents, install info
 */

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();

// ── Removal patterns (order matters — broader patterns last) ──
const REMOVE_PATTERNS = [
  // Bundle savings & financing
  /\(?financing available\)?\.?/gi,
  /save \$[\d,.]+\+? ?\+? ?free shipping[^.!]*[.!]?/gi,
  /save \$[\d,.]+\s*(when you purchase|with this|on this)[^.!]*[.!]?/gi,
  /save up to \$[\d,.]+[^.!]*[.!]?/gi,
  /order now and (get |save )[^.!]*[.!]?/gi,
  /order now and get up to a \$[\d,.]+[^.!]*[.!]?/gi,

  // Free shipping USA
  /free shipping in (the )?usa\.?/gi,
  /free shipping (in|within|to) (the )?(us|usa|united states)[^.!]*[.!]?/gi,
  /\+ ?free shipping[^.!]*/gi,
  /ships free in (the )?us\.?/gi,

  // Discount/promo
  /use (coupon |promo )?code [A-Z0-9]+[^.!]*[.!]?/gi,
  /discount[^.!]*coupon[^.!]*[.!]?/gi,

  // Dollar prices in promotional context (not technical specs)
  /priced at \$[\d,.]+\.?/gi,
  /only \$[\d,.]+\.?/gi,
  /just \$[\d,.]+\.?/gi,
  /regular price \$[\d,.]+\.?/gi,
  /msrp:?\s*\$[\d,.]+\.?/gi,

  // Buy now / CTA
  /\b(buy|order|shop|purchase) (now|today)\b[.!]?/gi,
  /add to cart\.?/gi,
  /click here[^.!]*[.!]?/gi,

  // External URLs
  /https?:\/\/[^\s<)"]+/gi,
  /www\.[^\s<)"]+/gi,
  /burgertuning\.com[^\s<)"]*/gi,

  // Contact info 
  /email[:\s]+\S+@\S+\.\S+/gi,
  /\S+@burgertuning\.com/gi,
  /\S+@burger\S+\.com/gi,
  /call us at[^.!]*[.!]?/gi,
  /contact us at[^.!]*[.!]?/gi,

  // Install guides (links, not mention)
  /install guides? can be downloaded from[^.!]*[.!]?/gi,
  /download the install guide[^.!]*[.!]?/gi,
  /for install guide[^.!]*click[^.!]*[.!]?/gi,

  // Forum / social
  /join (our|the) (facebook|fb|community)[^.!]*[.!]?/gi,
  /visit (our|the) forum[^.!]*[.!]?/gi,

  // YouTube (remove URLs but keep "see video" loosely)
  /watch the (install|installation)? ?video[^.!]*youtube[^.!]*[.!]?/gi,
  /check out (our|the) video[^.!]*youtube[^.!]*[.!]?/gi,
  /see (the )?(install|installation)? ?video[^.!]*youtube[^.!]*[.!]?/gi,
];

// ── Replacement patterns (rewrite, not remove) ──
const REPLACE_PATTERNS = [
  // Generic warranty (keep fact, remove specifics about Burger's own warranty)
  [/includes a (\d+)[- ]year (limited )?warranty from (burger|bms)[^.!]*[.!]?/gi, 'Includes manufacturer warranty.'],
  [/(\d+)[- ]year (limited )?(manufacturer('s)?|factory) ?warranty[^.!]*/gi, 'Manufacturer warranty included.'],
  [/backed by (a |our )?(\d+)[- ]year warranty\.?/gi, 'Backed by manufacturer warranty.'],
  // "Made in the USA" — keep as factual but simplify
  [/proudly made in the usa\.?/gi, 'Made in USA.'],
  [/designed and manufactured in the usa\.?/gi, 'Designed and manufactured in USA.'],
];

function cleanDescription(text) {
  if (!text || text.length < 10) return text;

  let cleaned = text;

  // Apply removal patterns
  for (const pattern of REMOVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Apply replacement patterns
  for (const [pattern, replacement] of REPLACE_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Clean up artifacts
  cleaned = cleaned
    // Remove orphaned parentheses
    .replace(/\(\s*\)/g, '')
    // Remove multiple spaces
    .replace(/  +/g, ' ')
    // Remove space before punctuation
    .replace(/ ([.,!?])/g, '$1')
    // Remove multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing spaces per line
    .replace(/^ +| +$/gm, '')
    // Remove empty sentences (just punctuation)
    .replace(/\.\s*\./g, '.')
    // Trim
    .trim();

  return cleaned;
}

async function main() {
  console.log('🧹 Cleaning Burger Motorsports descriptions...\n');

  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { id: true, titleEn: true, bodyHtmlEn: true },
  });

  console.log(`Found ${products.length} products with descriptions\n`);

  let changed = 0;
  let unchanged = 0;
  let totalRemoved = 0;
  const examples = [];

  for (const product of products) {
    const original = product.bodyHtmlEn;
    const cleaned = cleanDescription(original);

    if (cleaned !== original) {
      const removed = original.length - cleaned.length;
      totalRemoved += removed;
      changed++;

      await prisma.shopProduct.update({
        where: { id: product.id },
        data: { bodyHtmlEn: cleaned },
      });

      // Collect examples
      if (examples.length < 5 && removed > 50) {
        examples.push({
          title: product.titleEn.slice(0, 60),
          originalLen: original.length,
          cleanedLen: cleaned.length,
          removed,
          sample: cleaned.slice(0, 200),
        });
      }
    } else {
      unchanged++;
    }
  }

  console.log('=== RESULTS ===');
  console.log(`  Changed: ${changed}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Total chars removed: ${totalRemoved.toLocaleString()}`);
  console.log(`  Avg removed per changed: ${changed > 0 ? Math.round(totalRemoved / changed) : 0} chars`);

  if (examples.length > 0) {
    console.log('\n=== EXAMPLES OF CLEANED DESCRIPTIONS ===');
    for (const ex of examples) {
      console.log(`\n  📝 ${ex.title}`);
      console.log(`     ${ex.originalLen} → ${ex.cleanedLen} chars (-${ex.removed})`);
      console.log(`     "${ex.sample}..."`);
    }
  }

  // Verify — re-run pattern check
  console.log('\n=== POST-CLEAN VERIFICATION ===');
  const afterAll = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { bodyHtmlEn: true },
  });

  const checks = [
    ['Free Shipping', /free shipping/i],
    ['Save $XX', /save \$\d/i],
    ['Financing', /financing/i],
    ['USA-only', /free shipping in (the )?usa|us only/i],
    ['External URLs', /https?:\/\//i],
    ['Dollar prices', /\$\d{2,}/],
    ['Buy/Order now', /buy now|order now/i],
    ['Contact info', /@burger|contact us at/i],
  ];

  for (const [name, rx] of checks) {
    const count = afterAll.filter(x => rx.test(x.bodyHtmlEn)).length;
    const icon = count === 0 ? '✅' : '⚠️';
    console.log(`  ${icon} ${name}: ${count} remaining`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
