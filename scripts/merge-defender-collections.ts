import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const commit = process.argv.includes("--commit");
const dryRun = !commit;

async function main() {
  console.log("=== Merging Defender 90/110/130 Collections ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  // 1. Find the collections
  const col110 = await prisma.shopCollection.findUnique({
    where: { handle: "land-rover-defender-110" },
  });

  const col90 = await prisma.shopCollection.findUnique({
    where: { handle: "land-rover-defender-90" },
  });

  const col130 = await prisma.shopCollection.findUnique({
    where: { handle: "land-rover-defender-130" },
  });

  if (!col110) {
    console.error("Error: Collection land-rover-defender-110 not found!");
    return;
  }

  console.log(`Found base Defender 110 collection: ${col110.id}`);
  if (col90) console.log(`Found Defender 90 collection: ${col90.id}`);
  if (col130) console.log(`Found Defender 130 collection: ${col130.id}`);

  // 2. Collect all product IDs from 90 and 130
  const productIds = new Set<string>();

  if (col90) {
    const prods90 = await prisma.shopProductCollection.findMany({
      where: { collectionId: col90.id },
    });
    prods90.forEach((p) => productIds.add(p.productId));
    console.log(`Defender 90 has ${prods90.length} products.`);
  }

  if (col130) {
    const prods130 = await prisma.shopProductCollection.findMany({
      where: { collectionId: col130.id },
    });
    prods130.forEach((p) => productIds.add(p.productId));
    console.log(`Defender 130 has ${prods130.length} products.`);
  }

  console.log(`Total unique products to merge into Defender 90/110/130: ${productIds.size}`);

  if (!dryRun) {
    try {
      // Step A: Update the base 110 collection to become the unified collection
      console.log(`Updating base collection handle and titles...`);
      await prisma.shopCollection.update({
        where: { id: col110.id },
        data: {
          handle: "land-rover-defender",
          titleUa: "Defender 90 / 110 / 130",
          titleEn: "Defender 90 / 110 / 130",
        },
      });

      // Step B: Associate products from 90 and 130 with the updated unified collection
      let addedCount = 0;
      for (const prodId of productIds) {
        // Check if already in unified collection (previously 110)
        const exists = await prisma.shopProductCollection.findUnique({
          where: {
            productId_collectionId: {
              productId: prodId,
              collectionId: col110.id,
            },
          },
        });

        if (!exists) {
          await prisma.shopProductCollection.create({
            data: {
              productId: prodId,
              collectionId: col110.id,
              sortOrder: 10, // Put merged ones at the end or neutral sort
            },
          });
          addedCount++;
        }
      }
      console.log(`Associated ${addedCount} new products with the unified collection.`);

      // Step C: Delete the old 90 and 130 collections
      if (col90) {
        console.log(`Deleting old Defender 90 collection...`);
        await prisma.shopCollection.delete({
          where: { id: col90.id },
        });
      }

      if (col130) {
        console.log(`Deleting old Defender 130 collection...`);
        await prisma.shopCollection.delete({
          where: { id: col130.id },
        });
      }

      console.log("[DB] Database migration completed successfully!");
    } catch (err: any) {
      console.error(`[DB ERROR] Migration failed: ${err.message}`);
    }
  } else {
    console.log(`\n[DRY-RUN] Would update collection land-rover-defender-110:`);
    console.log(`  New Handle: land-rover-defender`);
    console.log(`  New Title: Defender 90 / 110 / 130`);
    console.log(`[DRY-RUN] Would merge ${productIds.size} products into the unified collection.`);
    if (col90) console.log(`[DRY-RUN] Would delete old Defender 90 collection: ${col90.id}`);
    if (col130) console.log(`[DRY-RUN] Would delete old Defender 130 collection: ${col130.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
