import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Searching DB for Panigale, Streetfighter, Diavel, V4 ---");
  const products = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { titleEn: { contains: "panigale", mode: "insensitive" } },
        { titleEn: { contains: "streetfighter", mode: "insensitive" } },
        { titleEn: { contains: "diavel", mode: "insensitive" } },
        { titleEn: { contains: "v4", mode: "insensitive" } },
      ],
    },
    select: {
      sku: true,
      titleEn: true,
      scope: true,
      brand: true,
    },
  });
  console.log(`Found ${products.length} products.`);
  console.log(JSON.stringify(products.slice(0, 30), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
