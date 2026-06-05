import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const restorations = [
  {
    sku: "URB-LOG-25353014-V1",
    image: "/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461_Kit_Front.jpg",
    gallery: [
      "/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461_Kit_Front.jpg",
      "/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461_Kit_Back.jpg"
    ]
  },
  {
    sku: "URB-FLO-26006230-V1",
    image: "/images/shop/urban/products/urus-se/Urban_Premium_Mat_Set.jpg",
    gallery: [
      "/images/shop/urban/products/urus-se/Urban_Premium_Mat_Set.jpg"
    ]
  }
];

async function main() {
  console.log("Reverting placeholders back to original local images...");

  for (const item of restorations) {
    const product = await prisma.shopProduct.findFirst({
      where: { sku: item.sku }
    });

    if (!product) {
      console.log(`Product with SKU ${item.sku} not found.`);
      continue;
    }

    console.log(`Updating ${item.sku}...`);
    
    // Update ShopProduct
    await prisma.shopProduct.update({
      where: { id: product.id },
      data: {
        image: item.image,
        gallery: item.gallery
      }
    });

    // Update ShopProductVariant
    await prisma.shopProductVariant.updateMany({
      where: { productId: product.id, isDefault: true },
      data: {
        image: item.image
      }
    });

    console.log(`Successfully reverted ${item.sku}!`);
  }
}

main()
  .catch((err) => {
    console.error("Error during restoration:", err);
  })
  .finally(() => prisma.$disconnect());
