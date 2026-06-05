#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { isBlobStorageConfigured } from "../src/lib/runtimeBlobStorage";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const commit = args.includes("--commit");
const dryRun = !commit || args.includes("--dry-run");

const BLOB_PREFIX = "media/library/urban/";
const DEFAULT_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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
  console.log("=== Audited Urban Products images → Vercel Blob Migration ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  if (!isBlobStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local before running.");
  }

  // Load the audit JSON (customizable via --file=...)
  const fileArg = args.find((a) => a.startsWith("--file="));
  const auditFilename = fileArg ? fileArg.split("=")[1] : "direct-placeholder-audit.json";
  const auditPath = path.resolve(process.cwd(), "scratch", auditFilename);
  if (!fs.existsSync(auditPath)) {
    throw new Error(
      `${auditFilename} not found at ${auditPath}! Run the corresponding audit script first.`
    );
  }

  const targets = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  console.log(`Found ${targets.length} placeholder products to update with real galleries.`);

  const dbProducts = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { sku: { in: targets.map((t: any) => t.sku) } },
        { slug: { in: targets.map((t: any) => t.slug) } },
      ],
    },
    select: {
      id: true,
      sku: true,
      slug: true,
      titleEn: true,
    },
  });

  let updatedCount = 0;

  for (const target of targets) {
    const { sku, slug, title, gpImages } = target;
    const dbProduct = dbProducts.find((p: any) => p.sku === sku || p.slug === slug);
    if (!dbProduct) {
      console.warn(`  [Warn] Product ${sku} not found in DB. Skipping.`);
      continue;
    }

    console.log(`\n----------------------------------------`);
    console.log(`Product: ${sku} - ${title}`);
    console.log(`  GP Images to upload:`, gpImages);

    const blobGalleryUrls: string[] = [];

    // Download and upload each real image in the gallery
    for (let i = 0; i < gpImages.length; i++) {
      const srcUrl = gpImages[i];
      console.log(`  [Image ${i}] Downloading: ${srcUrl}`);

      let buffer: Buffer;
      try {
        const response = await fetch(srcUrl);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
      } catch (err: any) {
        console.error(`  [Image ${i}] [ERROR] Download failed: ${err.message}`);
        continue;
      }

      // Format filenames: sku.png for primary (index 0), sku-1.png, sku-2.png etc.
      const cleanUrl = srcUrl.split("?")[0];
      const ext = path.extname(cleanUrl) || ".png";
      const filename = i === 0 ? `${sku.toLowerCase()}${ext}` : `${sku.toLowerCase()}-${i}${ext}`;
      const blobPathname = `${BLOB_PREFIX}${filename}`;
      const contentType = contentTypeFor(filename);

      let blobUrl = "";
      if (!dryRun) {
        try {
          console.log(`  [Image ${i}] Uploading to Vercel Blob...`);
          const result = await put(blobPathname, buffer, {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            cacheControlMaxAge: DEFAULT_CACHE_MAX_AGE_SECONDS,
            contentType,
            multipart: buffer.byteLength >= 10 * 1024 * 1024,
          });
          blobUrl = result.url;
          console.log(`  [Image ${i}] Uploaded: ${blobUrl}`);
        } catch (err: any) {
          console.error(`  [Image ${i}] [ERROR] Upload failed: ${err.message}`);
          continue;
        }
      } else {
        blobUrl = `https://store_mock.public.blob.vercel-storage.com/${blobPathname}`;
        console.log(`  [DRY-RUN] Would upload to Vercel Blob. Mock URL: ${blobUrl}`);
      }

      blobGalleryUrls.push(blobUrl);
    }

    if (blobGalleryUrls.length === 0) {
      console.error(`  [ERROR] No images were successfully uploaded for this product.`);
      continue;
    }

    const primaryBlobUrl = blobGalleryUrls[0];
    console.log(`  Updating product in DB...`);
    console.log(`    Primary Image: ${primaryBlobUrl}`);
    console.log(`    Gallery: ${JSON.stringify(blobGalleryUrls)}`);

    if (!dryRun) {
      try {
        // Update product table
        await prisma.shopProduct.update({
          where: { id: dbProduct.id },
          data: {
            image: primaryBlobUrl,
            gallery: blobGalleryUrls,
          },
        });

        // Update default variant table
        await prisma.shopProductVariant.updateMany({
          where: { productId: dbProduct.id, isDefault: true },
          data: {
            image: primaryBlobUrl,
          },
        });

        console.log(`  [DB] Successfully updated product and variants for ${sku}!`);
        updatedCount++;
      } catch (err: any) {
        console.error(`  [DB ERROR] Failed to update product in database: ${err.message}`);
      }
    } else {
      console.log(`  [DRY-RUN] Would update ShopProduct ${sku} in DB.`);
      updatedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Migration finished! Updated ${updatedCount}/${targets.length} products.`);
}

main()
  .catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
