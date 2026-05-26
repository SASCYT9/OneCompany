import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const targetBrands = ["AKRAPOVIC", "OHLINS", "CSF", "ADRO"];
  console.log(`Starting pricing cleanup for brands: ${targetBrands.join(", ")}`);

  // 1. Update ShopProductVariant
  const variantUpdate = await prisma.shopProductVariant.updateMany({
    where: {
      product: {
        brand: {
          in: targetBrands,
          mode: "insensitive",
        },
      },
    },
    data: {
      priceUsd: null,
      priceUah: null,
      compareAtUsd: null,
      compareAtUah: null,
    },
  });

  console.log(
    `Updated ${variantUpdate.count} product variants: set priceUsd, priceUah, compareAtUsd, compareAtUah to null.`
  );

  // 2. Update ShopProduct
  const productUpdate = await prisma.shopProduct.updateMany({
    where: {
      brand: {
        in: targetBrands,
        mode: "insensitive",
      },
    },
    data: {
      priceUsd: null,
      priceUah: null,
      compareAtUsd: null,
      compareAtUah: null,
    },
  });

  console.log(
    `Updated ${productUpdate.count} products: set priceUsd, priceUah, compareAtUsd, compareAtUah to null.`
  );

  console.log("Cleanup complete! All USD/UAH prices cleared for synced brands.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
