#!/usr/bin/env tsx
/*
 * Migrate Brabus product galleries from local /brabus-images/<file> paths
 * in the ShopProduct.gallery JSON field to Vercel Blob storage absolute URLs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/migrate-brabus-gallery-to-blob.ts            (dry-run; default)
 *   npx tsx --env-file=.env.local scripts/migrate-brabus-gallery-to-blob.ts --commit
 */

import { PrismaClient } from "@prisma/client";
import { isBlobStorageConfigured, listAllBlobsByPrefix } from "@/lib/runtimeBlobStorage";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const commit = args.includes("--commit");
const dryRun = !commit;

const BLOB_PREFIX = "brabus-images/";

async function main() {
  console.log("=== Brabus gallery JSON field → Vercel Blob migration ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  if (!isBlobStorageConfigured()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local (or pull from Vercel) before running."
    );
  }

  console.log("Fetching all blobs from Vercel Blob storage...");
  const blobs = await listAllBlobsByPrefix(BLOB_PREFIX);
  console.log(`Found ${blobs.length} blobs in storage.`);

  // Build rewrite map: /brabus-images/filename.ext -> URL
  const rewriteMap = new Map<string, string>();
  for (const blob of blobs) {
    const filename = blob.pathname.slice(BLOB_PREFIX.length);
    const oldRef = `/brabus-images/${filename}`;
    rewriteMap.set(oldRef, blob.url);
  }
  console.log(`Rewrite mappings ready: ${rewriteMap.size}`);

  console.log("Fetching products from database...");
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: { equals: "brabus", mode: "insensitive" },
    },
    select: {
      id: true,
      slug: true,
      gallery: true,
    },
  });

  console.log(`Scanned ${products.length} Brabus products.`);

  let updatedProductsCount = 0;
  let totalReplacementsCount = 0;

  for (const product of products) {
    if (!product.gallery || !Array.isArray(product.gallery)) {
      continue;
    }

    let changed = false;
    const newGallery = product.gallery.map((item) => {
      if (typeof item === "string" && item.startsWith("/brabus-images/")) {
        const mappedUrl = rewriteMap.get(item);
        if (mappedUrl) {
          changed = true;
          totalReplacementsCount++;
          return mappedUrl;
        }
      }
      return item;
    });

    if (changed) {
      updatedProductsCount++;
      if (commit) {
        await prisma.shopProduct.update({
          where: { id: product.id },
          data: { gallery: newGallery },
        });
      } else {
        console.log(`(dry-run) Would update gallery for ${product.slug}:`);
        console.log(`  Before:`, product.gallery);
        console.log(`  After: `, newGallery);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total products scanned:      ${products.length}`);
  console.log(`Products needing updates:    ${updatedProductsCount}`);
  console.log(`Total gallery items updated: ${totalReplacementsCount}`);

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
