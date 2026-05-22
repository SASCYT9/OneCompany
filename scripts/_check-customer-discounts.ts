import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");
  const cust = await prisma.shopCustomer.findUnique({
    where: { email: "b2b@gmail.com" },
    select: { id: true, b2bDiscountPercent: true, brandDiscounts: true },
  });
  console.log("customer:", JSON.stringify(cust, null, 2));

  const sysRows = await prisma.$queryRaw<Array<any>>`
    SELECT brand, "discountPct"::text FROM "ShopBrandB2bDiscount" ORDER BY brand
  `;
  console.log("\nSystem brand rules:", sysRows);

  // Brabus product
  const brabus = await prisma.shopProduct.findFirst({
    where: { sku: "465-234-00" },
    select: {
      id: true,
      slug: true,
      brand: true,
      vendor: true,
      priceUsd: true,
      priceEur: true,
      priceUah: true,
      priceUsdB2b: true,
      priceEurB2b: true,
      priceUahB2b: true,
      compareAtUsd: true,
      compareAtEur: true,
      compareAtUah: true,
      compareAtUsdB2b: true,
      compareAtEurB2b: true,
    },
  });
  console.log("\nBrabus product 465-234-00:", JSON.stringify(brabus, null, 2));

  await prisma.$disconnect();
})();
