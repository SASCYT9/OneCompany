import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.shopProduct.findFirst({
    where: {
      OR: [{ sku: "S-B10E10-APLT/1" }, { slug: "akrapovic-s-b10e10-aplt-1" }],
    },
    include: {
      media: true,
      variants: true,
    },
  });

  if (p) {
    console.log("Product Found:");
    console.log(`SKU: ${p.sku}`);
    console.log(`Slug: ${p.slug}`);
    console.log(`Main Image Field: ${p.image}`);
    console.log(`Gallery Field: ${JSON.stringify(p.gallery)}`);
    console.log("Media Records:");
    console.log(p.media);
    console.log("Variants:");
    p.variants.forEach((v, index) => {
      console.log(`Variant ${index + 1}: ${v.sku}, Default: ${v.isDefault}, Image: ${v.image}`);
    });
  } else {
    console.log("Product not found in DB!");
  }
}

main().finally(() => prisma.$disconnect());
