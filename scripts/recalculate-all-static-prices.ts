import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Recalculating static database prices for non-iPE brands...");

  const usdRate = 1.152174;
  const uahRate = 53;

  // 1. Recalculate variants
  const variants = await prisma.shopProductVariant.findMany({
    where: {
      priceEur: { not: null },
      OR: [{ priceUah: { not: null } }, { priceUsd: { not: null } }],
      product: {
        brand: { not: "iPE exhaust" },
      },
    },
    include: {
      product: true,
    },
  });

  console.log(`Found ${variants.length} variants to update.`);

  let variantUpdates = 0;
  for (const v of variants) {
    if (v.priceEur === null) continue;
    const eur = Number(v.priceEur);

    // For UAH, round to whole number
    const newUah = Math.round(eur * uahRate);
    // For USD, round to 2 decimal places (or whole number if eur has no cents)
    const newUsd =
      eur % 1 === 0 ? Math.round(eur * usdRate) : Math.round(eur * usdRate * 100) / 100;

    await prisma.shopProductVariant.update({
      where: { id: v.id },
      data: {
        priceUah: newUah,
        priceUsd: newUsd,
      },
    });
    variantUpdates += 1;
  }
  console.log(`Updated ${variantUpdates} variants in database.`);

  // 2. Recalculate top-level products
  const products = await prisma.shopProduct.findMany({
    where: {
      priceEur: { not: null },
      OR: [{ priceUah: { not: null } }, { priceUsd: { not: null } }],
      brand: { not: "iPE exhaust" },
    },
  });

  console.log(`Found ${products.length} products to update.`);

  let productUpdates = 0;
  for (const p of products) {
    if (p.priceEur === null) continue;
    const eur = Number(p.priceEur);

    const newUah = Math.round(eur * uahRate);
    const newUsd =
      eur % 1 === 0 ? Math.round(eur * usdRate) : Math.round(eur * usdRate * 100) / 100;

    await prisma.shopProduct.update({
      where: { id: p.id },
      data: {
        priceUah: newUah,
        priceUsd: newUsd,
      },
    });
    productUpdates += 1;
  }
  console.log(`Updated ${productUpdates} products in database.`);

  console.log("Recalculation complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
