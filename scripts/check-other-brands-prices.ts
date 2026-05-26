import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const brands = ["Remus", "CSF", "DO88"];

  for (const brand of brands) {
    const products = await prisma.shopProduct.findMany({
      where: { brand },
      take: 3,
      select: {
        sku: true,
        priceUah: true,
        priceEur: true,
        priceUsd: true,
      },
    });

    console.log(`\nSample products for brand: ${brand}`);
    for (const p of products) {
      console.log(
        `SKU: ${p.sku} | priceEur: ${p.priceEur} | priceUah: ${p.priceUah} | priceUsd: ${p.priceUsd}`
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
