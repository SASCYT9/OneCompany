import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: {
        contains: "akrap",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      sku: true,
      titleUa: true,
      scope: true,
      priceUah: true,
    },
  });

  console.log(`Found ${products.length} Akrapovic products in the database:`);
  for (const p of products) {
    console.log(`- [${p.scope}] SKU: ${p.sku} | Price: ${p.priceUah} UAH | Title: ${p.titleUa}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
