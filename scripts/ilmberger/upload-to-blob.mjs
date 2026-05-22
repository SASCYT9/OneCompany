/**
 * Upload all Ilmberger product images to Vercel Blob + update DB.
 *
 * Why: 52MB of photos under public/images/shop/ilmberger/products/ get
 * bundled into Vercel Function output, pushing api/admin/shop/forged/references
 * past the 300MB function size limit (was 1.04GB). Moving images to Blob
 * keeps the public/ directory tiny and the function size sane.
 *
 * What it does:
 *  1. Walk public/images/shop/ilmberger/products/ for every {sku-slug}/{N}.jpg
 *  2. Upload each to Vercel Blob at path images/shop/ilmberger/products/{sku-slug}/{N}.jpg
 *     (uses content-addressable random suffix to avoid filename collisions
 *     between deployments — Vercel Blob default).
 *  3. Update shopProduct rows: replace local /images/shop/... paths in
 *     `image` (single) and `gallery` (array) with Blob URLs.
 *  4. Write a mapping JSON for audit at tmp/ilmberger-blob-uploads.json.
 *
 * Idempotent: if the Blob URL is already in DB for a given SKU, the row
 * is skipped (no re-upload, no DB write).
 *
 * Run: node --env-file=.env.local scripts/ilmberger/upload-to-blob.mjs
 * Dry-run (upload, no DB write): add --dry-run
 */
import { put, list } from "@vercel/blob";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");
const LOCAL_ROOT = "public/images/shop/ilmberger/products";
const BLOB_PREFIX = "images/shop/ilmberger/products";
const MAP_OUT = "tmp/ilmberger-blob-uploads.json";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN not set. Add to .env.local.");
  process.exit(1);
}

const prisma = new PrismaClient();

// ── Pre-flight: list what's already on Blob so we can skip re-uploads ───
console.log(`📡 Listing existing Blob files under ${BLOB_PREFIX}/...`);
const existing = new Map(); // pathname → url
let cursor;
do {
  const { blobs, cursor: next } = await list({
    prefix: `${BLOB_PREFIX}/`,
    cursor,
  });
  for (const b of blobs) existing.set(b.pathname, b.url);
  cursor = next;
} while (cursor);
console.log(`   Found ${existing.size} files already on Blob.\n`);

// ── Walk local directory ────────────────────────────────────────────────
const skuDirs = readdirSync(LOCAL_ROOT).filter((d) => {
  const p = path.join(LOCAL_ROOT, d);
  return statSync(p).isDirectory();
});
console.log(`📂 Found ${skuDirs.length} SKU directories locally`);

const uploads = []; // { sku, localPath, blobUrl }
let uploaded = 0;
let cached = 0;
let failed = 0;

for (const skuSlug of skuDirs) {
  const dir = path.join(LOCAL_ROOT, skuSlug);
  const files = readdirSync(dir)
    .filter((f) => /\.(jpg|jpeg|png|webp|avif)$/i.test(f))
    .sort();
  for (const file of files) {
    const localAbs = path.join(dir, file);
    const localRel = `/${LOCAL_ROOT}/${skuSlug}/${file}`.replace(/\\/g, "/");
    const blobPath = `${BLOB_PREFIX}/${skuSlug}/${file}`;

    // Check Blob cache: Vercel adds a random suffix to filenames by default,
    // so the pathname won't be EXACTLY blobPath — it will START with blobPath.
    // Match on prefix (any file under that sku/filename → cached).
    const cachedUrl = [...existing.entries()].find(([p]) =>
      p.startsWith(`${BLOB_PREFIX}/${skuSlug}/${file.replace(/\.\w+$/, "")}`)
    )?.[1];

    if (cachedUrl) {
      uploads.push({ sku: skuSlug, localPath: localRel, blobUrl: cachedUrl });
      cached++;
      continue;
    }

    try {
      const body = readFileSync(localAbs);
      const contentType = /\.(jpg|jpeg)$/i.test(file)
        ? "image/jpeg"
        : /\.png$/i.test(file)
          ? "image/png"
          : /\.webp$/i.test(file)
            ? "image/webp"
            : /\.avif$/i.test(file)
              ? "image/avif"
              : "application/octet-stream";
      const result = await put(blobPath, body, {
        access: "public",
        contentType,
        addRandomSuffix: true,
      });
      uploads.push({ sku: skuSlug, localPath: localRel, blobUrl: result.url });
      uploaded++;
      process.stdout.write(`  ✓ ${skuSlug}/${file} → Blob\n`);
    } catch (e) {
      console.log(`  ✗ ${skuSlug}/${file} FAILED: ${e.message}`);
      failed++;
    }
  }
}

mkdirSync(path.dirname(MAP_OUT), { recursive: true });
writeFileSync(MAP_OUT, JSON.stringify(uploads, null, 2));
console.log(
  `\n✅ Uploaded ${uploaded}, cached ${cached}, failed ${failed} of ${uploads.length} total files.`
);
console.log(`   Mapping → ${MAP_OUT}`);

if (DRY_RUN) {
  console.log("\n⏭ DRY-RUN: skipping DB updates. Run again without --dry-run to write.");
  await prisma.$disconnect();
  process.exit(0);
}

// ── Update DB ────────────────────────────────────────────────────────────
console.log(`\n💾 Updating shopProduct rows…`);
// Build local→blob map keyed by local-path
const localToBlob = new Map(uploads.map((u) => [u.localPath, u.blobUrl]));

const products = await prisma.shopProduct.findMany({
  where: { brand: "Ilmberger Carbon" },
  select: { id: true, sku: true, image: true, gallery: true },
});

let updated = 0;
let skipped = 0;
for (const p of products) {
  const newImage = p.image && localToBlob.get(p.image) ? localToBlob.get(p.image) : p.image;
  const galleryArr = Array.isArray(p.gallery) ? p.gallery : [];
  const newGallery = galleryArr.map((g) =>
    typeof g === "string" && localToBlob.get(g) ? localToBlob.get(g) : g
  );
  // Skip if nothing changed (e.g. row already has Blob URLs from a prior run)
  if (newImage === p.image && JSON.stringify(newGallery) === JSON.stringify(galleryArr)) {
    skipped++;
    continue;
  }
  await prisma.shopProduct.update({
    where: { id: p.id },
    data: { image: newImage, gallery: newGallery },
  });
  updated++;
}
console.log(`✅ DB updated ${updated}, skipped ${skipped} of ${products.length} Ilmberger rows.`);

await prisma.$disconnect();
