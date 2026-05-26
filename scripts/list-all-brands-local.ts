import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Listing all brands in database ---");
  const counts = await prisma.shopProduct.groupBy({
    by: ["brand"],
    _count: {
      id: true,
    },
  });
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
