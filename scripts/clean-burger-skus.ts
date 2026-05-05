import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
// Run dry: npx tsx scripts/clean-burger-skus.ts
// Commit:  npx tsx scripts/clean-burger-skus.ts --commit
//
// Burger's Shopify variants often expose a variant *title* in the `sku` field
// (e.g. "+ PRO BT Adapter", "Alfa Romeo JB4 + PRO BT Adapter"). The scraper
// previously passed those straight through. This script identifies products
// whose stored sku is non-canonical and rewrites both ShopProduct.sku and
// every ShopProductVariant.sku to `BURGER-${shopifyProductId}`.
//
// "Suspicious" SKU = contains whitespace OR starts with a non-alphanumeric char.

type SourceProduct = { slug: string; shopifyProductId: number };

function isSuspicious(sku: string | null): boolean {
  if (!sku) return true;
  if (/\s/.test(sku)) return true;
  if (!/^[A-Za-z0-9]/.test(sku)) return true;
  return false;
}

async function main() {
  const commit = process.argv.includes('--commit');
  const mode = commit ? 'COMMIT' : 'DRY-RUN';

  const filePath = path.join(process.cwd(), 'data', 'burger-products.json');
  const json: SourceProduct[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const sourceBySlug = new Map<string, SourceProduct>(
    json.map((p) => [`burger-${p.slug}`, p]),
  );

  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, slug: true, sku: true, variants: { select: { id: true, sku: true } } },
  });

  console.log(`🍔 Burger SKU cleanup [${mode}]`);
  console.log(`📦 DB: ${products.length} Burger products\n`);

  let productsUpdated = 0;
  let variantsUpdated = 0;
  let noSource = 0;
  const productExamples: string[] = [];

  for (const p of products) {
    const productBad = isSuspicious(p.sku);
    const badVariants = p.variants.filter((v) => isSuspicious(v.sku));
    if (!productBad && badVariants.length === 0) continue;

    const source = sourceBySlug.get(p.slug);
    if (!source) {
      noSource++;
      continue;
    }
    const newSku = `BURGER-${source.shopifyProductId}`;

    if (productBad) {
      productExamples.push(`  [${p.slug}] product.sku: "${p.sku}" → "${newSku}"`);
      productsUpdated++;
      if (commit) {
        await prisma.shopProduct.update({
          where: { id: p.id },
          data: { sku: newSku },
        });
      }
    }

    if (badVariants.length > 0) {
      variantsUpdated += badVariants.length;
      if (commit) {
        await prisma.shopProductVariant.updateMany({
          where: { id: { in: badVariants.map((v) => v.id) } },
          data: { sku: newSku },
        });
      }
    }
  }

  console.log(`Products with bad SKU (${productsUpdated}):`);
  productExamples.slice(0, 50).forEach((e) => console.log(e));
  if (productExamples.length > 50) {
    console.log(`  ... and ${productExamples.length - 50} more`);
  }
  console.log('');
  console.log(`✅ ${mode} complete. Products updated: ${productsUpdated}, Variants updated: ${variantsUpdated}, No source in JSON: ${noSource}`);
  if (!commit && productsUpdated + variantsUpdated > 0) {
    console.log(`\n   Re-run with --commit to apply.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
