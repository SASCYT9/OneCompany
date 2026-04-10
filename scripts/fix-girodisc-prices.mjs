import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL;
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

const UAH_TO_USD_ATOMIC = 45;
const DISCOUNT = 0.9;

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'girodisc-products.json');
  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`Loaded ${products.length} products to completely restore and re-price from JSON...`);

  let updated = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    
    let priceUsd = null;
    let compareAtUsd = null;

    if (p.priceUah && p.priceUah > 0) {
      priceUsd = (p.priceUah / UAH_TO_USD_ATOMIC) * DISCOUNT;
    }
    if (p.compareAtPriceUah && p.compareAtPriceUah > 0) {
      compareAtUsd = (p.compareAtPriceUah / UAH_TO_USD_ATOMIC) * DISCOUNT;
    }

    try {
      let slug = p.handle;
      if (!slug.startsWith('girodisc-')) slug = `girodisc-${slug}`;
      slug = slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 200);

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
    } catch (e) {
      // Ignore missing
    }
  }

  console.log(`\n✅ Restored and updated ${updated} products.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
