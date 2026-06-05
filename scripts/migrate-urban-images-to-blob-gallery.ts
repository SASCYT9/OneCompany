#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as cheerio from "cheerio";
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

async function fetchGalleryFromProductPage(productHandle: string): Promise<string[]> {
  const url = `https://gp-portal.eu/products/${productHandle}`;
  console.log(`  [Fetch] Fetching gallery from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const imageUrls: string[] = [];

    // Find all images within product media elements
    $(".product__media img, .product__media-list img, .product-single__media img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src && !src.includes("placeholder")) {
        let cleanUrl = src.split("&width=")[0].split("&amp;width=")[0].split("?width=")[0];
        if (cleanUrl.startsWith("//")) {
          cleanUrl = "https:" + cleanUrl;
        }
        imageUrls.push(cleanUrl);
      }
    });

    // Fallback: If cheerio query returned nothing, search for pattern using regex
    if (imageUrls.length === 0) {
      const regex = /\/\/gp-portal\.eu\/cdn\/shop\/files\/[^"\s?]+/g;
      const matches = [...html.matchAll(regex)];
      for (const m of matches) {
        let cleanUrl = m[0];
        if (cleanUrl.startsWith("//")) {
          cleanUrl = "https:" + cleanUrl;
        }
        imageUrls.push(cleanUrl);
      }
    }

    return [...new Set(imageUrls)];
  } catch (err: any) {
    console.error(`  [Fetch ERROR] Failed to fetch product page: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log("=== Urban L461 images → Vercel Blob Gallery Migration ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  if (!isBlobStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local before running.");
  }

  // Load the variants JSON directly to get URLs/handles
  const gpVariantsPath = path.resolve(
    process.cwd(),
    "archive",
    "scratch",
    "gp-portal-variants.json"
  );
  if (!fs.existsSync(gpVariantsPath)) {
    throw new Error(`gp-portal-variants.json not found!`);
  }

  const gpVariants = JSON.parse(fs.readFileSync(gpVariantsPath, "utf8"));
  const compPath = path.resolve(process.cwd(), "archive", "scratch", "image-comparison.json");
  const comparison = JSON.parse(fs.readFileSync(compPath, "utf8"));

  const targets = comparison.filter((item: any) => item.gpImage && item.dbId);
  console.log(`Found ${targets.length} products to update with full galleries.`);

  let updatedCount = 0;

  for (const target of targets) {
    const { dbId, dbSku, dbTitle, gpSku } = target;
    console.log(`\n----------------------------------------`);
    console.log(`Product: ${dbSku} - ${dbTitle}`);

    // Get the product handle from the gpVariants JSON by matching SKU
    const gpProduct = gpVariants.find(
      (v: any) =>
        v.sku === gpSku || (v.sku && v.sku.replace(/-V\d+$/i, "") === gpSku.replace(/-V\d+$/i, ""))
    );
    if (!gpProduct) {
      console.warn(`  [Warn] Could not find GP product variant for SKU ${gpSku}. Skipping.`);
      continue;
    }

    const urlPath = gpProduct.product.url; // e.g. /products/urb-sid-26006229-v1?_pos=1...
    const handleMatch = urlPath.match(/\/products\/([^?#]+)/);
    if (!handleMatch) {
      console.warn(`  [Warn] Could not extract handle from URL ${urlPath}. Skipping.`);
      continue;
    }
    const handle = handleMatch[1];
    console.log(`  Extracted handle: ${handle}`);

    // Fetch all gallery images from the product details page
    const galleryUrls = await fetchGalleryFromProductPage(handle);
    console.log(`  Found ${galleryUrls.length} gallery images on GP Portal:`, galleryUrls);

    if (galleryUrls.length === 0) {
      console.warn(`  [Warn] No gallery images found on the product page. Skipping.`);
      continue;
    }

    const blobGalleryUrls: string[] = [];

    // Download and upload each image in the gallery
    for (let i = 0; i < galleryUrls.length; i++) {
      const srcUrl = galleryUrls[i];
      console.log(`  [Gallery Image ${i}] Downloading: ${srcUrl}`);

      let buffer: Buffer;
      try {
        const response = await fetch(srcUrl);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
      } catch (err: any) {
        console.error(`  [Gallery Image ${i}] [ERROR] Download failed: ${err.message}`);
        continue;
      }

      // Format filenames: sku.png for primary (index 0), sku-1.png, sku-2.png for subsequent ones
      const cleanUrl = srcUrl.split("?")[0];
      const ext = path.extname(cleanUrl) || ".png";
      const filename =
        i === 0 ? `${dbSku.toLowerCase()}${ext}` : `${dbSku.toLowerCase()}-${i}${ext}`;
      const blobPathname = `${BLOB_PREFIX}${filename}`;
      const contentType = contentTypeFor(filename);

      let blobUrl = "";
      if (!dryRun) {
        try {
          console.log(`  [Gallery Image ${i}] Uploading to Blob (allowOverwrite: true)...`);
          const result = await put(blobPathname, buffer, {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            cacheControlMaxAge: DEFAULT_CACHE_MAX_AGE_SECONDS,
            contentType,
            multipart: buffer.byteLength >= 10 * 1024 * 1024,
          });
          blobUrl = result.url;
          console.log(`  [Gallery Image ${i}] Uploaded: ${blobUrl}`);
        } catch (err: any) {
          console.error(`  [Gallery Image ${i}] [ERROR] Upload failed: ${err.message}`);
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
          where: { id: dbId },
          data: {
            image: primaryBlobUrl,
            gallery: blobGalleryUrls,
          },
        });

        // Update default variant table
        await prisma.shopProductVariant.updateMany({
          where: { productId: dbId, isDefault: true },
          data: {
            image: primaryBlobUrl,
          },
        });

        console.log(`  [DB] Successfully updated product and variants for ${dbSku}!`);
        updatedCount++;
      } catch (err: any) {
        console.error(`  [DB ERROR] Failed to update product in database: ${err.message}`);
      }
    } else {
      console.log(
        `  [DRY-RUN] Would update ShopProduct ${dbSku} primary image to ${primaryBlobUrl} and gallery to ${JSON.stringify(blobGalleryUrls)}`
      );
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
