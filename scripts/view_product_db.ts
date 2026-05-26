import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.shopProduct.findFirst({
    where: {
      sku: "S-B10E9-APLT", // BMW S1000RR Evolution Line
    },
    include: {
      metafields: true,
    },
  });
  console.log("Product:", JSON.stringify(product, null, 2));
}

main().finally(() => prisma.$disconnect());
