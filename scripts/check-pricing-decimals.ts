import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const brands = ["ADRO", "Remus", "Range Rover"];

  for (const brand of brands) {
    const products = await prisma.shopProduct.findMany({
      where: { brand: { contains: brand, mode: "insensitive" } },
      take: 3,
      select: {
        sku: true,
        priceEur: true,
        priceUah: true,
        priceUsd: true,
      },
    });

    console.log(`\nSample products for brand: ${brand}`);
    for (const p of products) {
      console.log(
        `SKU: ${p.sku} | priceEur: ${p.priceEur} (${typeof p.priceEur}) | priceUah: ${p.priceUah} | priceUsd: ${p.priceUsd}`
      );
    }
  }

  const variants = await prisma.shopProductVariant.findMany({
    where: {
      product: {
        brand: { contains: "Range Rover", mode: "insensitive" },
      },
    },
    take: 3,
    select: {
      sku: true,
      priceEur: true,
      priceUah: true,
      priceUsd: true,
    },
  });

  console.log("\nSample variants for Range Rover:");
  for (const v of variants) {
    console.log(
      `SKU: ${v.sku} | priceEur: ${v.priceEur} | priceUah: ${v.priceUah} | priceUsd: ${v.priceUsd}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
