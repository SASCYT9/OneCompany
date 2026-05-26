#!/usr/bin/env tsx
/*
 * Clean up mismatched gallery images and media entries for all Brabus products.
 *
 * For each Brabus product:
 * - Always keeps the primary image (position = 1).
 * - For auxiliary images (position > 1), parses the original filename from the
 *   media source URL and checks if it matches the product's SKU prefix or SKU segments.
 * - If the image filename belongs to a completely different part number, it deletes
 *   it from the media table and removes it from the product's gallery.
 * - Updates the remaining media items' sources to point to Vercel Blob URLs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-brabus-gallery-mismatches.ts            (dry-run; default)
 *   npx tsx --env-file=.env.local scripts/cleanup-brabus-gallery-mismatches.ts --commit
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const commit = args.includes("--commit");
const dryRun = !commit;

// Matching logic to determine if an image filename is relevant to the SKU
function isMediaMatchingSku(filename: string, sku: string): boolean {
  const lowerFile = filename.toLowerCase();
  const lowerSku = sku.toLowerCase();

  // 1. Exact match or contains full SKU
  if (lowerFile.includes(lowerSku)) return true;

  const parts = lowerSku.split("-");
  if (parts.length >= 3) {
    // 2. Check SKU prefix (first 3 parts, e.g. '465-800-fsb' for '465-800-fsb-99')
    const prefix = parts.slice(0, 3).join("-");
    const cleanPrefix = prefix.replace(/[^a-z0-9]/g, "");
    const cleanFile = lowerFile.replace(/[^a-z0-9]/g, "");
    if (cleanFile.includes(cleanPrefix)) return true;

    // 3. Check SKU mid-section (parts 2 & 3, e.g. 'b40-700' for '464-b40-700-99')
    const midSection = parts.slice(1, 3).join("-");
    const cleanMid = midSection.replace(/[^a-z0-9]/g, "");
    if (cleanFile.includes(cleanMid)) return true;
  }

  // 4. General assets/fallbacks are allowed
  if (
    lowerFile.includes("stealth") ||
    lowerFile.includes("fallback") ||
    lowerFile.includes("hero")
  ) {
    return true;
  }

  return false;
}

async function main() {
  console.log("=== Brabus Mismatched Gallery & Media Cleanup ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  console.log("Fetching Brabus products and media...");
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: { equals: "brabus", mode: "insensitive" },
    },
    include: {
      media: {
        orderBy: { position: "asc" },
      },
    },
  });

  console.log(`Loaded ${products.length} Brabus products.`);

  let updatedProductsCount = 0;
  let totalDeletedMediaCount = 0;
  let totalUpdatedMediaCount = 0;

  for (const product of products) {
    const sku = product.sku;
    if (!sku) continue;

    const gallery = Array.isArray(product.gallery) ? product.gallery : [];
    if (gallery.length === 0) continue;

    const mediaToDeleteIds: string[] = [];
    const mediaToUpdate: Array<{ id: string; src: string }> = [];
    const cleanGallery: string[] = [];

    // Loop over media items. Position is 1-indexed.
    for (const m of product.media) {
      const isPrimary = m.position === 1;
      const filename = m.src.split("/").pop() || "";

      const isMatch = isPrimary || isMediaMatchingSku(filename, sku);

      const correspondingGalleryUrl = gallery[m.position - 1];

      if (isMatch) {
        // Keep the media item.
        // If there's a Vercel Blob URL in the gallery for this position, update media.src to use it.
        const targetSrc =
          correspondingGalleryUrl && correspondingGalleryUrl.startsWith("https://")
            ? correspondingGalleryUrl
            : m.src;

        if (targetSrc !== m.src) {
          mediaToUpdate.push({ id: m.id, src: targetSrc });
        }
        cleanGallery.push(targetSrc);
      } else {
        // Mismatch: delete the media item and exclude from gallery.
        mediaToDeleteIds.push(m.id);
      }
    }

    const galleryChanged = JSON.stringify(product.gallery) !== JSON.stringify(cleanGallery);

    if (galleryChanged || mediaToDeleteIds.length > 0 || mediaToUpdate.length > 0) {
      updatedProductsCount++;

      if (mediaToDeleteIds.length > 0) {
        totalDeletedMediaCount += mediaToDeleteIds.length;
      }
      if (mediaToUpdate.length > 0) {
        totalUpdatedMediaCount += mediaToUpdate.length;
      }

      if (commit) {
        // 1. Update product gallery
        await prisma.shopProduct.update({
          where: { id: product.id },
          data: { gallery: cleanGallery },
        });

        // 2. Delete mismatched media
        if (mediaToDeleteIds.length > 0) {
          await prisma.shopProductMedia.deleteMany({
            where: { id: { in: mediaToDeleteIds } },
          });
        }

        // 3. Update remaining media paths to use Vercel Blob URLs
        for (const update of mediaToUpdate) {
          await prisma.shopProductMedia.update({
            where: { id: update.id },
            data: { src: update.src },
          });
        }
      } else {
        console.log(`Product: ${product.slug} (SKU: ${sku})`);
        console.log(`  Gallery count before: ${gallery.length} -> after: ${cleanGallery.length}`);
        if (mediaToDeleteIds.length > 0) {
          console.log(`  Will delete ${mediaToDeleteIds.length} mismatched media items.`);
        }
        if (mediaToUpdate.length > 0) {
          console.log(`  Will update ${mediaToUpdate.length} media paths to Blob URLs.`);
        }
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total products scanned:       ${products.length}`);
  console.log(`Products updated/cleaned:     ${updatedProductsCount}`);
  console.log(`Total media entries deleted:  ${totalDeletedMediaCount}`);
  console.log(`Total media paths updated:    ${totalUpdatedMediaCount}`);

  if (dryRun) {
    console.log(`\n(dry-run) — pass --commit to apply.`);
  }
}

main()
  .catch((err) => {
    console.error("\nFATAL:", err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
