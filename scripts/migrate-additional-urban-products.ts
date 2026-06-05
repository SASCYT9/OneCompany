import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { isBlobStorageConfigured } from "../src/lib/runtimeBlobStorage";

const prisma = new PrismaClient();
const commit = process.argv.includes("--commit");
const dryRun = !commit;

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

const additionalProducts = [
  {
    sku: "URB-GRI-26006222-V1",
    images: [
      "https://gp-portal.eu/cdn/shop/files/URB-GRI-26006222-V1.png",
      "https://gp-portal.eu/cdn/shop/files/Urban_20Automotive_20Range_20Rover_20Sport_20L461_20Front_203Q-V2_d7009a18-378f-4967-a5ee-b741933f0aa7.jpg",
      "https://gp-portal.eu/cdn/shop/files/440-0286_L461_20Sport_20-_20Carbon_20Fibre_20Matrix_20Grille_20-_202x2_20Twill_2.png",
      "https://gp-portal.eu/cdn/shop/files/440-0286_L461_20Sport_20-_20Carbon_20Fibre_20Matrix_20Grille_20-_202x2_20Twill_3.png",
    ],
  },
  {
    sku: "URB-SIL-26006225-V1",
    images: [
      "https://gp-portal.eu/cdn/shop/files/URB-SIL-26006225-V1.png",
      "https://gp-portal.eu/cdn/shop/files/Urban_20Automotive_20Range_20Rover_20Sport_20L461_20Front_203Q-V2_54eec7da-6c8b-405a-9a6c-ed38e72669f8.jpg",
      "https://gp-portal.eu/cdn/shop/files/URB-SIL-26006225-V1_20Achteraanzicht.png",
    ],
  },
];

async function main() {
  console.log("=== Migrating Additional L461 Urban Products ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  if (!isBlobStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local before running.");
  }

  for (const prod of additionalProducts) {
    console.log(`\nProcessing: ${prod.sku}`);
    const dbProduct = await prisma.shopProduct.findFirst({
      where: { sku: prod.sku },
    });

    if (!dbProduct) {
      console.warn(`  [Warn] Product with SKU ${prod.sku} not found in DB!`);
      continue;
    }

    const blobUrls: string[] = [];

    for (let i = 0; i < prod.images.length; i++) {
      const srcUrl = prod.images[i];
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

      // Format pathname
      const cleanUrl = srcUrl.split("?")[0];
      const ext = path.extname(cleanUrl) || ".png";
      const filename =
        i === 0 ? `${prod.sku.toLowerCase()}${ext}` : `${prod.sku.toLowerCase()}-${i}${ext}`;
      const blobPathname = `${BLOB_PREFIX}${filename}`;
      const contentType = contentTypeFor(filename);

      let blobUrl = "";
      if (!dryRun) {
        try {
          console.log(`  [Image ${i}] Uploading to Blob (allowOverwrite: true)...`);
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

      blobUrls.push(blobUrl);
    }

    if (blobUrls.length === 0) {
      console.error(`  [ERROR] No images were successfully uploaded for ${prod.sku}`);
      continue;
    }

    const primaryUrl = blobUrls[0];
    console.log(`  Updating ${prod.sku} in DB...`);
    console.log(`    Primary Image: ${primaryUrl}`);
    console.log(`    Gallery: ${JSON.stringify(blobUrls)}`);

    if (!dryRun) {
      try {
        await prisma.shopProduct.update({
          where: { id: dbProduct.id },
          data: {
            image: primaryUrl,
            gallery: blobUrls,
          },
        });

        await prisma.shopProductVariant.updateMany({
          where: { productId: dbProduct.id, isDefault: true },
          data: {
            image: primaryUrl,
          },
        });

        console.log(`  [DB] Successfully updated ${prod.sku}!`);
      } catch (err: any) {
        console.error(`  [DB ERROR] Failed to update: ${err.message}`);
      }
    } else {
      console.log(`  [DRY-RUN] Would update ShopProduct ${prod.sku} in DB.`);
    }
  }

  console.log("\nMigration finished!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
