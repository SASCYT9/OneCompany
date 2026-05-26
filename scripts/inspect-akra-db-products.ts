import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Inspecting Akrapovič database products ---");

  // Find all distinct brand names in the DB
  const distinctBrands = await prisma.shopProduct.findMany({
    select: { brand: true },
    distinct: ["brand"],
  });
  console.log(
    "Distinct brands in DB:",
    distinctBrands.map((b) => b.brand)
  );

  // Count by brand and scope for any brand containing 'akrap'
  const akrapovicProducts = await prisma.shopProduct.groupBy({
    by: ["brand", "scope"],
    _count: {
      id: true,
    },
    where: {
      brand: {
        contains: "akrap",
        mode: "insensitive",
      },
    },
  });

  console.log(
    "Akrapovič products grouped by brand and scope:",
    JSON.stringify(akrapovicProducts, null, 2)
  );

  // Let's print a few samples of both auto and moto if they exist
  const autoSamples = await prisma.shopProduct.findMany({
    where: {
      brand: { contains: "akrap", mode: "insensitive" },
      scope: "auto",
    },
    take: 3,
    select: { sku: true, titleEn: true, scope: true, brand: true },
  });

  const motoSamples = await prisma.shopProduct.findMany({
    where: {
      brand: { contains: "akrap", mode: "insensitive" },
      scope: "moto",
    },
    take: 3,
    select: { sku: true, titleEn: true, scope: true, brand: true },
  });

  console.log("Auto Samples:", autoSamples);
  console.log("Moto Samples:", motoSamples);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
