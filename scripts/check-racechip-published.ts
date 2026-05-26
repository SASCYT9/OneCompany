import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const allCount = await prisma.shopProduct.count({
    where: {
      OR: [
        { brand: { equals: "racechip", mode: "insensitive" } },
        { vendor: { equals: "racechip", mode: "insensitive" } },
      ],
    },
  });
  const publishedCount = await prisma.shopProduct.count({
    where: {
      isPublished: true,
      OR: [
        { brand: { equals: "racechip", mode: "insensitive" } },
        { vendor: { equals: "racechip", mode: "insensitive" } },
      ],
    },
  });
  console.log({ allCount, publishedCount });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
