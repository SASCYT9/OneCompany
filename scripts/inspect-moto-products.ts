import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Dumping all Moto products from DB ---");
  const product = await prisma.shopProduct.findFirst({
    where: {
      sku: "S-B10E10-APLT/1",
    },
    include: {
      metafields: true,
      media: true,
    },
  });
  console.log(JSON.stringify(product, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
