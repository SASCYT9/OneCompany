#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { isBlobStorageConfigured, putPublicBlob } from "../src/lib/runtimeBlobStorage";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const commit = args.includes("--commit");
const dryRun = !commit || args.includes("--dry-run");

const BLOB_PREFIX = "media/library/urban/";

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".avif") return "image/avif";
  return "application/octet-stream";
}

async function main() {
  console.log("=== Urban L461 images → Vercel Blob migration ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  if (!isBlobStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local before running.");
  }

  const compPath = path.resolve(process.cwd(), "archive", "scratch", "image-comparison.json");
  if (!fs.existsSync(compPath)) {
    throw new Error(`Comparison file not found at ${compPath}`);
  }

  const comparison = JSON.parse(fs.readFileSync(compPath, "utf8"));
  const targets = comparison.filter((item: any) => item.gpImage && item.dbId);

  console.log(`Found ${targets.length} products to potentially update.`);

  let updatedCount = 0;

  for (const target of targets) {
    const { dbId, dbSku, gpImage, dbTitle } = target;
    console.log(`\nProcessing: ${dbSku} - ${dbTitle}`);
    console.log(`  Source GP Image: ${gpImage}`);

    // Fetch the image
    let buffer: Buffer;
    try {
      const response = await fetch(gpImage);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
      console.log(`  Downloaded: ${buffer.byteLength} bytes`);
    } catch (err: any) {
      console.error(`  [ERROR] Failed to download image: ${err.message}`);
      continue;
    }

    // Determine filename
    // gpImage url might be like: https://gp-portal.eu/cdn/shop/files/URB-VEN-26009351-V1.png?v=1779976032
    // We clean it up and extract name
    const cleanUrl = gpImage.split("?")[0];
    const originalExt = path.extname(cleanUrl) || ".png";
    const filename = `${dbSku.toLowerCase()}${originalExt}`;
    const blobPathname = `${BLOB_PREFIX}${filename}`;
    const contentType = contentTypeFor(filename);

    console.log(`  Target Blob Pathname: ${blobPathname}`);

    let blobUrl = "";
    if (!dryRun) {
      try {
        console.log(`  Uploading to Vercel Blob...`);
        const result = await putPublicBlob(blobPathname, buffer, contentType);
        blobUrl = result.url;
        console.log(`  Uploaded successfully! Blob URL: ${blobUrl}`);
      } catch (err: any) {
        console.error(`  [ERROR] Failed to upload to Vercel Blob: ${err.message}`);
        continue;
      }
    } else {
      blobUrl = `https://store_mock.public.blob.vercel-storage.com/${blobPathname}`;
      console.log(`  [DRY-RUN] Would upload to Vercel Blob. Mock URL: ${blobUrl}`);
    }

    // Update product in database
    if (!dryRun) {
      try {
        await prisma.shopProduct.update({
          where: { id: dbId },
          data: {
            image: blobUrl,
            gallery: [blobUrl], // Overwrite/reset gallery with the new Vercel Blob URL as the primary image
          },
        });
        console.log(`  [DB] Successfully updated product ${dbSku}!`);
        updatedCount++;
      } catch (err: any) {
        console.error(`  [ERROR] Failed to update product in database: ${err.message}`);
      }
    } else {
      console.log(`  [DRY-RUN] Would update ShopProduct ${dbSku} image to ${blobUrl}`);
      updatedCount++;
    }
  }

  console.log(`\n=== Migration finished! ===`);
  console.log(`Successfully processed/updated: ${updatedCount}/${targets.length} products.`);
}

main()
  .catch((err) => {
    console.error("\nFATAL ERROR:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
