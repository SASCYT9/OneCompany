import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: {
      scope: "moto",
    },
    select: {
      sku: true,
      titleEn: true,
      longDescEn: true,
      bodyHtmlEn: true,
    },
  });
  console.log(`Found ${products.length} products:`);
  products.forEach((p) => {
    console.log(
      `- ${p.sku} | ${p.titleEn} | bodyHtmlEn: ${p.bodyHtmlEn ? p.bodyHtmlEn.slice(0, 100) + "..." : "none"}`
    );
  });
}

main().finally(() => prisma.$disconnect());
