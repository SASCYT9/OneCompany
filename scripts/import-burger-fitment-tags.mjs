// Imports the brand/model/chassis/engine tags from
// data/burger-products-with-fitment.json into existing DB ShopProducts.
// Matches by SKU first, then by slug. Only updates the `tags` column.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();
const SRC = path.join(process.cwd(), 'data', 'burger-products-with-fitment.json');

async function main() {
  const enriched = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  console.log(`Source: ${enriched.length} products`);

  // Pull all DB burger products in one go to avoid per-row connection churn
  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, sku: true, slug: true, tags: true, titleEn: true },
  });
  console.log(`DB: ${dbProducts.length} burger products`);

  const bySku = new Map(dbProducts.filter(p => p.sku).map(p => [p.sku, p]));
  const bySlug = new Map(dbProducts.map(p => [p.slug, p]));

  let matched = 0, updated = 0, unchanged = 0, missing = 0;
  const missingExamples = [];

  // Batch updates in chunks of 50
  const updates = [];
  for (const src of enriched) {
    const slug = `burger-${src.slug}`;
    const sku = src.sku;
    const target = (sku && bySku.get(sku)) || bySlug.get(slug);
    if (!target) {
      missing++;
      if (missingExamples.length < 5) missingExamples.push(`${src.sku || src.slug} | ${src.title.slice(0,80)}`);
      continue;
    }
    matched++;
    // Preserve existing non-fitment tags, replace fitment tags with new set
    const fitmentPrefixes = ['brand:', 'type:', 'vendor:', 'model:', 'chassis:', 'engine:'];
    const preserved = (target.tags || []).filter(t => !fitmentPrefixes.some(p => t.startsWith(p)));
    const merged = [...new Set([...preserved, ...(src.tags || [])])];

    // Compare
    const sortedExisting = [...(target.tags || [])].sort().join('|');
    const sortedNew = [...merged].sort().join('|');
    if (sortedExisting === sortedNew) {
      unchanged++;
      continue;
    }
    updates.push({ id: target.id, tags: merged });
  }

  console.log(`Matched: ${matched}, Missing in DB: ${missing}, Unchanged: ${unchanged}, To update: ${updates.length}`);
  if (missingExamples.length) {
    console.log('Missing examples:');
    missingExamples.forEach(s => console.log('  - ' + s));
  }

  // Apply updates sequentially (DB has connection limit)
  for (const u of updates) {
    await prisma.shopProduct.update({ where: { id: u.id }, data: { tags: u.tags } });
    updated++;
    if (updated % 25 === 0 || updated === updates.length) {
      process.stdout.write(`\r  Updated ${updated}/${updates.length}...`);
    }
  }
  console.log(`\n✓ Done. ${updated} products updated.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
