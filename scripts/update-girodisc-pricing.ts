import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL;
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

const UAH_TO_EUR_ATOMIC = 52;
const UAH_TO_USD_ATOMIC = 45;
const DISCOUNT = 0.9;

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'girodisc-products.json');
  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`Loaded ${products.length} products to re-price...`);

  let updated = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    
    // GiroDisc is an American brand, so their base price is likely derived from USD originally.
    // Atomic used a 45 USD / 52 EUR rate.
    // If the value is in UAH, the original MSRP in USD was: UAH / 45
    // Our price with -10% discount in USD:
    let priceUsd = null;
    let compareAtUsd = null;

    if (p.priceUah && p.priceUah > 0) {
      priceUsd = (p.priceUah / UAH_TO_USD_ATOMIC) * DISCOUNT;
    }
    if (p.compareAtPriceUah && p.compareAtPriceUah > 0) {
      compareAtUsd = (p.compareAtPriceUah / UAH_TO_USD_ATOMIC) * DISCOUNT;
    }

    try {
      // Find the product by SKU or Slug
      let slug = p.handle;
      if (!slug.startsWith('girodisc-')) slug = `girodisc-${slug}`;
      slug = slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 200);

      // We clear UAH and EUR prices out of the DB, forcing the website's dynamic store rates to take over.
      const product = await prisma.shopProduct.update({
        where: { slug: slug },
        data: {
          priceUsd: priceUsd,
          compareAtUsd: compareAtUsd,
          priceUah: null,
          priceEur: null,
          compareAtUah: null,
          compareAtEur: null
        }
      });

      await prisma.shopProductVariant.updateMany({
        where: { productId: product.id },
        data: {
          priceUsd: priceUsd,
          compareAtUsd: compareAtUsd,
          priceUah: null,
          priceEur: null,
          compareAtUah: null,
          compareAtEur: null
        }
      });

      updated++;
      if (updated % 50 === 0) console.log(`  Updated ${updated}...`);
    } catch (e) {
      // Product might be missing or other error, ignore
    }
  }

  console.log(`\n✅ Done! Updated pricing for ${updated} products.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
