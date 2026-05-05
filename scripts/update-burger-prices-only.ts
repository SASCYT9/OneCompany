import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
// Run dry: npx tsx scripts/update-burger-prices-only.ts
// Commit:  npx tsx scripts/update-burger-prices-only.ts --commit
//
// Updates ONLY priceUsd on ShopProduct and ShopProductVariant for Burger
// Motorsports products that have a non-null priceUsd in data/burger-products.json.
// Never touches titles, descriptions, media, gallery, tags, EUR/UAH/B2B prices,
// or compareAt prices. Mirror of the Turn14 discipline (price/dim only on update).

type SourceProduct = {
  title: string;
  slug: string;
  priceUsd: number | null;
};

async function main() {
  const commit = process.argv.includes('--commit');
  const mode = commit ? 'COMMIT' : 'DRY-RUN';

  const filePath = path.join(process.cwd(), 'data', 'burger-products.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${filePath} not found. Run scrape-burger first.`);
    process.exit(1);
  }

  const all: SourceProduct[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const priced = all.filter((p) => p.priceUsd != null && p.priceUsd > 0);

  console.log(`🍔 Burger price-only update [${mode}]`);
  console.log(`📦 Source: ${all.length} total, ${priced.length} with priceUsd`);
  console.log('');

  let updated = 0;
  let unchanged = 0;
  let notFound = 0;
  const diffs: string[] = [];

  for (const p of priced) {
    const slug = `burger-${p.slug}`;
    const existing = await prisma.shopProduct.findUnique({
      where: { slug },
      select: { id: true, priceUsd: true },
    });

    if (!existing) {
      notFound++;
      continue;
    }

    const oldPrice = existing.priceUsd ? Number(existing.priceUsd) : null;
    const newPrice = p.priceUsd as number;

    if (oldPrice !== null && Math.abs(oldPrice - newPrice) < 0.005) {
      unchanged++;
      continue;
    }

    const oldStr = oldPrice === null ? 'null' : `$${oldPrice.toFixed(2)}`;
    const delta =
      oldPrice === null
        ? '(new)'
        : `Δ ${newPrice - oldPrice >= 0 ? '+' : ''}$${(newPrice - oldPrice).toFixed(2)}`;
    diffs.push(`  [${p.slug}] ${oldStr} → $${newPrice.toFixed(2)} ${delta}`);
    updated++;

    if (commit) {
      await prisma.shopProduct.update({
        where: { id: existing.id },
        data: { priceUsd: newPrice },
      });
      await prisma.shopProductVariant.updateMany({
        where: { productId: existing.id },
        data: { priceUsd: newPrice },
      });
    }
  }

  console.log(`Diff (${updated} products):`);
  diffs.forEach((d) => console.log(d));
  console.log('');
  console.log(`✅ ${mode} complete. Updated: ${updated}, Unchanged: ${unchanged}, Not in DB: ${notFound}`);
  if (!commit && updated > 0) {
    console.log(`\n   Re-run with --commit to apply.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
