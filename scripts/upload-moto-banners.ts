import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fetch from "node-fetch";
import { putPublicBlob, isBlobStorageConfigured } from "../src/lib/runtimeBlobStorage.js";

const BANNERS_TO_UPLOAD = [
  {
    name: "ducati-panigale-v4-akrapovic-installed",
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_D11E3_FJTD_1_Z.jpg",
    blobPathname: "akrapovic-moto/ducati-panigale-v4-installed.jpg",
  },
  {
    name: "bmw-s1000rr-akrapovic-installed",
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_B10E9_APLT_Z.jpg",
    blobPathname: "akrapovic-moto/bmw-s1000rr-installed.jpg",
  },
  {
    name: "yamaha-r1-akrapovic-installed",
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_Y10E3_APT_Z.jpg",
    blobPathname: "akrapovic-moto/yamaha-r1-installed.jpg",
  },
  {
    name: "bmw-r1300gs-akrapovic-installed",
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_B13SO4_HLGT_Z.jpg",
    blobPathname: "akrapovic-moto/bmw-r1300gs-installed.jpg",
  },
  {
    name: "kawasaki-zx10r-akrapovic-installed",
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_K10SO27_HRC_Z.jpg",
    blobPathname: "akrapovic-moto/kawasaki-zx10r-installed.jpg",
  },
];

async function main() {
  console.log("=== Uploading Official Akrapovič Bike Installed Banners to Vercel Blob ===");

  if (!isBlobStorageConfigured()) {
    console.error("ERROR: Vercel Blob storage is not configured!");
    process.exit(1);
  }

  for (const item of BANNERS_TO_UPLOAD) {
    try {
      console.log(`Downloading: ${item.name} from ${item.imageUrl}...`);
      const response = await fetch(item.imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      console.log(`Uploading to Vercel Blob: ${item.blobPathname}...`);
      const blobResult = await putPublicBlob(item.blobPathname, buffer, "image/jpeg");
      console.log(`Uploaded! URL: ${blobResult.url}`);
    } catch (err) {
      console.error(`Error for ${item.name}:`, err);
    }
  }

  console.log("=== Done! ===");
}

main().catch(console.error);
