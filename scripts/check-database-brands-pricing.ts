import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking which brands have non-null UAH or USD prices in the database...");

  // Group products by brand and check if they have priceUah or priceUsd
  const products = await prisma.shopProduct.findMany({
    select: {
      brand: true,
      priceUah: true,
      priceUsd: true,
      priceEur: true,
    },
  });

  const brandStats: Record<
    string,
    { total: number; hasUah: number; hasUsd: number; hasEur: number }
  > = {};

  for (const p of products) {
    const brand = p.brand || "Unknown";
    if (!brandStats[brand]) {
      brandStats[brand] = { total: 0, hasUah: 0, hasUsd: 0, hasEur: 0 };
    }
    brandStats[brand].total += 1;
    if (p.priceUah !== null && Number(p.priceUah) > 0) brandStats[brand].hasUah += 1;
    if (p.priceUsd !== null && Number(p.priceUsd) > 0) brandStats[brand].hasUsd += 1;
    if (p.priceEur !== null && Number(p.priceEur) > 0) brandStats[brand].hasEur += 1;
  }

  console.log("\nBrand Pricing Analysis (Top-level ShopProduct):");
  console.table(brandStats);

  // Group variants by brand and check
  const variants = await prisma.shopProductVariant.findMany({
    select: {
      priceUah: true,
      priceUsd: true,
      priceEur: true,
      product: {
        select: {
          brand: true,
        },
      },
    },
  });

  const variantStats: Record<
    string,
    { total: number; hasUah: number; hasUsd: number; hasEur: number }
  > = {};
  for (const v of variants) {
    const brand = v.product?.brand || "Unknown";
    if (!variantStats[brand]) {
      variantStats[brand] = { total: 0, hasUah: 0, hasUsd: 0, hasEur: 0 };
    }
    variantStats[brand].total += 1;
    if (v.priceUah !== null && Number(v.priceUah) > 0) variantStats[brand].hasUah += 1;
    if (v.priceUsd !== null && Number(v.priceUsd) > 0) variantStats[brand].hasUsd += 1;
    if (v.priceEur !== null && Number(v.priceEur) > 0) variantStats[brand].hasEur += 1;
  }

  console.log("\nVariant Pricing Analysis (ShopProductVariant):");
  console.table(variantStats);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
