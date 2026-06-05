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

// Ignore logos and favicons
function isLogoOrFavicon(url: string): boolean {
  const norm = url.toLowerCase();
  return (
    norm.includes("logo") ||
    norm.includes("favicon") ||
    norm.includes("gp-portal-logo") ||
    norm.includes("gpproducts_logo")
  );
}

// Config for L460 products migration
const l460ProductsConfig = [
  {
    sku: "URB-BOD-25353001-V1",
    // Order matters: first image will be primary.
    // We prefer col-image-1-lg-3.jpg (real car photo) as primary over white-background bumper photo URB-BOD-25353001-V1.png
    images: [
      "https://gp-portal.eu/cdn/shop/files/col-image-1-lg-3.jpg",
      "https://gp-portal.eu/cdn/shop/files/URB-BOD-25353001-V1.png",
      "https://gp-portal.eu/cdn/shop/files/URB-BOD-25353001-V1_20Zijaanzicht.png",
      "https://gp-portal.eu/cdn/shop/files/URB-BOD-25353001-V1_20Achteraanzicht.png",
    ],
  },
  {
    sku: "URB-WID-25353015-V1",
    images: ["https://gp-portal.eu/cdn/shop/files/URB-WID-25353015-V1.png"],
    // For wide arches, we keep the original DB image as primary (showing the car), and append this as additional
    keepDbPrimary: true,
  },
  {
    sku: "URB-SPO-25353021-V1",
    images: [
      "https://gp-portal.eu/cdn/shop/files/URB-SPO-25353021-V1_20Achteraanzicht_466edfce-69a1-4e1a-b027-bc7bd3f1e6f3.png",
      "https://gp-portal.eu/cdn/shop/files/BROCHU00005_71172e8b-39a4-4fea-a5ba-0ed065a82a5e.jpg",
    ],
  },
  {
    sku: "URB-SID-25353026-V1", // Matrix fixed steps LWB
    images: [
      "https://gp-portal.eu/cdn/shop/files/GRILLE_STEPS_RANGEROVER_SPORT_ONCAR_3_1800x1800_2f547379-7678-47b1-8e5b-5ed8fc5b4a97.jpg",
      "https://gp-portal.eu/cdn/shop/files/URB-SID-25353026-V1.png",
    ],
  },
  {
    sku: "URB-SID-25353027-V1", // Linear fixed steps LWB
    images: [
      "https://gp-portal.eu/cdn/shop/files/CLOSE_4_1800x1800_c4dd36e6-2712-402b-93c8-744c8690add4.jpg",
      "https://gp-portal.eu/cdn/shop/files/URB-SID-25353027-V1.png",
    ],
  },
  {
    sku: "URB-SPO-25353016-V1", // ABS spoiler
    images: [
      "https://gp-portal.eu/cdn/shop/files/URB-SPO-25353021-V1_20Achteraanzicht.png",
      "https://gp-portal.eu/cdn/shop/files/BROCHU00005.jpg",
    ],
  },
  {
    sku: "URB-SID-25353019-V1", // Carbon sills SWB
    images: ["https://gp-portal.eu/cdn/shop/files/URB-SID-25353019-V1.png"],
    keepDbPrimary: true,
  },
  {
    sku: "URB-SID-25353024-V1", // Matrix steps SWB
    images: [
      "https://gp-portal.eu/cdn/shop/files/GRILLE_STEPS_RANGEROVER_SPORT_ONCAR_3_1800x1800_e7bfaead-a102-4796-b81f-bdedbea17543.jpg",
      "https://gp-portal.eu/cdn/shop/files/URB-SID-25353024-V1.png",
    ],
  },
  {
    sku: "URB-SID-25353025-V1", // Linear steps SWB
    images: [
      "https://gp-portal.eu/cdn/shop/files/CLOSE_4_1800x1800_bdc8e856-6ccf-49b2-adcc-dced1a279e35.jpg",
      "https://gp-portal.eu/cdn/shop/files/URB-SID-25353025-V1.png",
    ],
  },
  {
    sku: "URB-SID-25353020-V1", // Carbon sills LWB
    images: ["https://gp-portal.eu/cdn/shop/files/URB-SID-25353020-V1.png"],
    keepDbPrimary: true,
  },
  {
    sku: "URB-SID-26014095-V1", // Carbon Side Accent Trim
    images: [
      "https://gp-portal.eu/cdn/shop/files/urban-range-rover-black-uc9-satin-black-carbon-sideblack-close-side-1920.png",
      "https://gp-portal.eu/cdn/shop/files/URB-SID-26014095-V1.png",
      "https://gp-portal.eu/cdn/shop/files/440-0229_20-_20L460_20Range_20Rover_20-_20Carbon_20Fibre_20Side_20Accent_20Trim_20-_20LH_7.png",
      "https://gp-portal.eu/cdn/shop/files/440-0229_20-_20L460_20Range_20Rover_20-_20Carbon_20Fibre_20Side_20Accent_20Trim_20-_20LH_5.png",
      "https://gp-portal.eu/cdn/shop/files/440-0229_20-_20L460_20Range_20Rover_20-_20Carbon_20Fibre_20Side_20Accent_20Trim_20-_20LH_6.png",
      "https://gp-portal.eu/cdn/shop/files/440-0229_20-_20L460_20Range_20Rover_20-_20Carbon_20Fibre_20Side_20Accent_20Trim_20-_20LH_2.png",
      "https://gp-portal.eu/cdn/shop/files/440-0229_20-_20L460_20Range_20Rover_20-_20Carbon_20Fibre_20Side_20Accent_20Trim_20-_20LH_3.png",
      "https://gp-portal.eu/cdn/shop/files/440-0229_20-_20L460_20Range_20Rover_20-_20Carbon_20Fibre_20Side_20Accent_20Trim_20-_20LH_1.png",
      "https://gp-portal.eu/cdn/shop/files/440-0229_20-_20L460_20Range_20Rover_20-_20Carbon_20Fibre_20Side_20Accent_20Trim_20-_20LH_4.png",
    ],
  },
];

async function main() {
  console.log("=== Migrating L460 Urban Products to Vercel Blob ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);

  if (!isBlobStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local before running.");
  }

  for (const config of l460ProductsConfig) {
    console.log(`\nProcessing Product: ${config.sku}`);
    const dbProduct = await prisma.shopProduct.findFirst({
      where: { sku: config.sku },
    });

    if (!dbProduct) {
      console.warn(`  [Warn] Product with SKU ${config.sku} not found in DB! Skipping.`);
      continue;
    }

    const filteredImages = config.images.filter((img) => !isLogoOrFavicon(img));
    if (filteredImages.length === 0) {
      console.log(`  No valid real images for ${config.sku}. Skipping.`);
      continue;
    }

    const blobUrls: string[] = [];

    // Download and upload images
    for (let i = 0; i < filteredImages.length; i++) {
      const srcUrl = filteredImages[i];
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

      // Format filenames
      const cleanUrl = srcUrl.split("?")[0];
      let ext = path.extname(cleanUrl) || ".png";
      // Normalize extension case
      ext = ext.toLowerCase();
      const filename =
        i === 0 ? `${config.sku.toLowerCase()}${ext}` : `${config.sku.toLowerCase()}-${i}${ext}`;
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
      console.error(`  [ERROR] No images were successfully uploaded for ${config.sku}`);
      continue;
    }

    // Determine primary image
    let primaryUrl = blobUrls[0];
    let finalGallery = [...blobUrls];

    if (config.keepDbPrimary && dbProduct.image) {
      // If we want to keep the original DB image as primary, we keep it first in database,
      // and append the new blob images to the gallery.
      primaryUrl = dbProduct.image;
      finalGallery = [dbProduct.image, ...blobUrls];
    }

    console.log(`  Updating ${config.sku} in DB...`);
    console.log(`    Primary Image: ${primaryUrl}`);
    console.log(`    Gallery: ${JSON.stringify(finalGallery)}`);

    if (!dryRun) {
      try {
        await prisma.shopProduct.update({
          where: { id: dbProduct.id },
          data: {
            image: primaryUrl,
            gallery: finalGallery,
          },
        });

        await prisma.shopProductVariant.updateMany({
          where: { productId: dbProduct.id, isDefault: true },
          data: {
            image: primaryUrl,
          },
        });

        console.log(`  [DB] Successfully updated ${config.sku}!`);
      } catch (err: any) {
        console.error(`  [DB ERROR] Failed to update: ${err.message}`);
      }
    } else {
      console.log(`  [DRY-RUN] Would update ShopProduct ${config.sku} in DB.`);
    }
  }

  console.log("\nMigration finished!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
