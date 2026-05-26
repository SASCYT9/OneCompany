import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Inspecting Ilmberger Carbon products and models in DB ---");

  // Find all distinct models or tags for Ilmberger Carbon products
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: { contains: "ilmberger", mode: "insensitive" },
    },
    select: {
      sku: true,
      titleEn: true,
      tags: true,
    },
  });

  console.log(`Total Ilmberger Carbon products in DB: ${products.length}`);

  // Extract all fits-make, fits-model tags
  const makes = new Set<string>();
  const models = new Set<string>();
  const fits = new Set<string>();

  for (const p of products) {
    if (p.tags) {
      for (const tag of p.tags) {
        if (tag.startsWith("fits-make:")) makes.add(tag);
        if (tag.startsWith("fits-model:")) models.add(tag);
        if (tag.startsWith("fits:")) fits.add(tag);
      }
    }
  }

  console.log("Unique makes for Ilmberger in DB:", Array.from(makes));
  console.log("Unique models for Ilmberger in DB:", Array.from(models));
  console.log("Unique fits tags for Ilmberger in DB:", Array.from(fits));

  if (products.length > 0) {
    console.log("Samples:");
    console.log(products.slice(0, 10));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
