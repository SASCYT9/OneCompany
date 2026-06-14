import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: { contains: "ADRO", mode: "insensitive" },
      priceUah: { not: null },
    },
    take: 5,
    select: {
      sku: true,
      priceEur: true,
      priceUah: true,
      priceUsd: true,
    },
  });

  console.log("ADRO products with UAH prices:");
  for (const p of products) {
    console.log(
      `SKU: ${p.sku} | priceEur: ${p.priceEur} | priceUah: ${p.priceUah} | priceUsd: ${p.priceUsd}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
