import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });
const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, "..", "scratch", "temp_prices.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Temp JSON file not found at: ${jsonPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(jsonPath, "utf8");
  const updates = JSON.parse(content) as Array<{
    sku: string;
    priceEur: number;
    compareAtEur: number | null;
  }>;
  console.log(`Loaded ${updates.length} updates from temp JSON.`);

  let successCount = 0;
  let failCount = 0;

  for (const item of updates) {
    try {
      // Find product by SKU
      const product = await prisma.shopProduct.findFirst({
        where: { sku: item.sku },
      });

      if (!product) {
        console.warn(`⚠️ Warning: SKU ${item.sku} not found in database.`);
        failCount++;
        continue;
      }

      // Update Product
      await prisma.shopProduct.update({
        where: { id: product.id },
        data: {
          priceEur: item.priceEur,
          priceUah: null,
          priceUsd: null,
          compareAtEur: item.compareAtEur,
          compareAtUah: null,
          compareAtUsd: null,
        },
      });

      // Update Variants
      await prisma.shopProductVariant.updateMany({
        where: { productId: product.id },
        data: {
          priceEur: item.priceEur,
          priceUah: null,
          priceUsd: null,
          compareAtEur: item.compareAtEur,
          compareAtUah: null,
          compareAtUsd: null,
        },
      });

      console.log(`✅ Updated SKU ${item.sku} -> priceEur: ${item.priceEur} EUR`);
      successCount++;
    } catch (err: any) {
      console.error(`❌ Failed to update SKU ${item.sku}:`, err.message);
      failCount++;
    }
  }

  // Delete the temp JSON file
  fs.unlinkSync(jsonPath);
  console.log("Removed temp JSON file.");

  console.log(`\n🎉 DB Update Summary:`);
  console.log(`   Successfully updated: ${successCount}`);
  console.log(`   Failed/Skipped:       ${failCount}`);
}

main()
  .catch((e) => {
    console.error("❌ DB Update failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
