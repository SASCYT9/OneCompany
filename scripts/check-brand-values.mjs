import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const brandsToCheck = ["brabus", "ohlins", "do88"];
  for (const b of brandsToCheck) {
    const products = await prisma.shopProduct.findMany({
      where: {
        OR: [
          { brand: { contains: b, mode: "insensitive" } },
          { vendor: { contains: b, mode: "insensitive" } },
        ],
      },
      select: {
        brand: true,
        vendor: true,
      },
    });

    const uniqueBrands = [...new Set(products.map((p) => p.brand))];
    const uniqueVendors = [...new Set(products.map((p) => p.vendor))];

    console.log(`\n=== Brand search: ${b} ===`);
    console.log(`Unique brand values in DB:`, uniqueBrands);
    console.log(`Unique vendor values in DB:`, uniqueVendors);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
