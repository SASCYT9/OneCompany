import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.shopProduct.findFirst({
    where: {
      sku: "URB-LOG-25353014-V1",
    },
    include: {
      variants: true
    }
  });
  console.log("Product:", JSON.stringify(product, null, 2));
}

main().finally(() => prisma.$disconnect());
