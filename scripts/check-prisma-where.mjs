import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const brands = ["brabus", "do88", "ohlins"];
  for (const b of brands) {
    let where;
    if (b === "ohlins") {
      where = {
        OR: [
          { brand: { equals: "ohlins", mode: "insensitive" } },
          { brand: { equals: "öhlins", mode: "insensitive" } },
          { vendor: { equals: "ohlins", mode: "insensitive" } },
          { slug: { startsWith: "ohlins-" } },
        ],
      };
    } else {
      where = {
        OR: [
          { brand: { equals: b, mode: "insensitive" } },
          { vendor: { equals: b, mode: "insensitive" } },
        ],
      };
    }

    const countWithPublished = await prisma.shopProduct.count({
      where: {
        isPublished: true,
        ...where,
      },
    });

    const countWithoutPublished = await prisma.shopProduct.count({
      where: {
        ...where,
      },
    });

    console.log(`Brand: ${b}`);
    console.log(`  Count with isPublished: true: ${countWithPublished}`);
    console.log(`  Count without: ${countWithoutPublished}`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
