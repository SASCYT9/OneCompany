import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating currency rates in the database...");
  const updated = await prisma.shopSettings.update({
    where: { key: "shop" },
    data: {
      currencyRates: {
        EUR: 1,
        USD: 1.152174,
        UAH: 53,
      },
    },
  });
  console.log("Rates updated successfully. New rates:");
  console.log(JSON.stringify(updated.currencyRates, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
