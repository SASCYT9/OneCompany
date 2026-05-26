import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { putPublicBlob, isBlobStorageConfigured } from "../src/lib/runtimeBlobStorage.ts";

async function main() {
  console.log("=== Uploading Panigale V2 WebP Images to Vercel Blob ===");

  if (!isBlobStorageConfigured()) {
    console.error(
      "Error: Vercel Blob is not configured. Check BLOB_READ_WRITE_TOKEN in .env.local"
    );
    process.exit(1);
  }

  const scratchDir =
    "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da\\scratch";
  const assets = [
    {
      localPath: path.join(scratchDir, "ducati-panigale-v2-installed.webp"),
      blobPath: "akrapovic-moto/ducati-panigale-v2-installed.webp",
      contentType: "image/webp",
    },
    {
      localPath: path.join(scratchDir, "S_D9E7_CKOT.webp"),
      blobPath: "akrapovic-moto/S_D9E7_CKOT.webp",
      contentType: "image/webp",
    },
  ];

  for (const asset of assets) {
    if (!fs.existsSync(asset.localPath)) {
      console.error(`Local file not found: ${asset.localPath}`);
      continue;
    }
    console.log(`Reading local file: ${asset.localPath}...`);
    const buffer = fs.readFileSync(asset.localPath);
    console.log(`Uploading to Vercel Blob: ${asset.blobPath}...`);
    const result = await putPublicBlob(asset.blobPath, buffer, asset.contentType);
    console.log(`Uploaded! URL: ${result.url}\n`);
  }
  console.log("Done.");
}

main().catch(console.error);
