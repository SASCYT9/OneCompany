import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.shopProduct.findFirst({
    where: { sku: "S-D9E7-CKOT" },
    include: { variants: true },
  });

  console.log("Product E-B10R7 details:");
  console.log(`- priceUah: ${p?.priceUah}`);
  console.log(`- priceEur: ${p?.priceEur}`);
  console.log(`- priceUsd: ${p?.priceUsd}`);

  if (p?.variants && p.variants.length > 0) {
    console.log("Variant details:");
    for (const v of p.variants) {
      console.log(`  - SKU: ${v.sku}`);
      console.log(`    priceUah: ${v.priceUah}`);
      console.log(`    priceEur: ${v.priceEur}`);
      console.log(`    priceUsd: ${v.priceUsd}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
