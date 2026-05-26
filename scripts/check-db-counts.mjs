import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const brands = [
  "adro",
  "akrapovic",
  "brabus",
  "csf",
  "ohlins",
  "girodisc",
  "ipe",
  "do88",
  "racechip",
];

async function run() {
  console.log("=== Checking DB product counts ===");
  for (const brand of brands) {
    const total = await prisma.shopProduct.count({
      where: {
        OR: [
          { brand: { contains: brand, mode: "insensitive" } },
          { vendor: { contains: brand, mode: "insensitive" } },
        ],
      },
    });

    const b2c = await prisma.shopProduct.count({
      where: {
        OR: [
          { brand: { contains: brand, mode: "insensitive" } },
          { vendor: { contains: brand, mode: "insensitive" } },
        ],
        isPublished: true,
        NOT: { tags: { has: "audience:b2b" } },
      },
    });

    const b2b = await prisma.shopProduct.count({
      where: {
        OR: [
          { brand: { contains: brand, mode: "insensitive" } },
          { vendor: { contains: brand, mode: "insensitive" } },
        ],
        isPublished: true,
        tags: { has: "audience:b2b" },
      },
    });

    console.log(`${brand}:`);
    console.log(`  Total: ${total}`);
    console.log(`  B2C (Public): ${b2c}`);
    console.log(`  B2B Only: ${b2b}`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
