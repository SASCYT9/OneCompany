#!/usr/bin/env tsx
/*
 * Migrate Brabus product images from local /brabus-images/<file> paths
 * (gitignored, ~808 MB) to Vercel Blob storage. Rewrites all DB references
 * (ShopProduct.image, ShopProductMedia.src, ShopProductVariant.image) to
 * the returned absolute Blob URLs.
 *
 * Idempotent: skips files already present in Blob, and skips DB rows
 * already pointing at https URLs. Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/migrate-brabus-images-to-blob.ts            (dry-run; default)
 *   npx tsx scripts/migrate-brabus-images-to-blob.ts --commit
 *   npx tsx scripts/migrate-brabus-images-to-blob.ts --commit --concurrency=12
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  deleteBlob,
  isBlobStorageConfigured,
  listAllBlobsByPrefix,
  putPublicBlob,
} from "@/lib/runtimeBlobStorage";
import {
  assertBlobCleanupSucceeded,
  deleteUploadedBlobUrls,
  getUnreferencedUploadedBlobUrls,
} from "@/lib/blobUploadRetention";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "@/lib/shopCatalogMutationCoordinator.server";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const commit = args.includes("--commit");
const dryRun = !commit;

const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
const CONCURRENCY = Math.max(
  1,
  Math.min(20, parseInt(concurrencyArg?.split("=")[1] ?? "8", 10) || 8)
);

const BLOB_PREFIX = "brabus-images/";
const PUBLIC_DIR = path.resolve(process.cwd(), "public", "brabus-images");
const uploadedThisRun = new Set<string>();

async function cleanupUnreferencedUploads() {
  if (!commit || uploadedThisRun.size === 0) return;
  const candidates = [...uploadedThisRun];
  const [products, media, variants] = await Promise.all([
    prisma.shopProduct.findMany({ where: { image: { in: candidates } }, select: { image: true } }),
    prisma.shopProductMedia.findMany({ where: { src: { in: candidates } }, select: { src: true } }),
    prisma.shopProductVariant.findMany({ where: { image: { in: candidates } }, select: { image: true } }),
  ]);
  const retained = new Set<string>();
  for (const value of [...products.map((row) => row.image), ...media.map((row) => row.src), ...variants.map((row) => row.image)]) {
    if (value) retained.add(value);
  }
  const orphaned = getUnreferencedUploadedBlobUrls(uploadedThisRun, retained);
  const cleanup = await deleteUploadedBlobUrls(orphaned, deleteBlob);
  console.log(`Orphan uploads removed: ${cleanup.deleted.length}/${orphaned.length}`);
  assertBlobCleanupSucceeded(cleanup.failures);
}

type LocalFile = {
  absolutePath: string;
  filename: string;
  blobPathname: string;
  oldReference: string;
  size: number;
  contentType: string;
};

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".avif") return "image/avif";
  return "application/octet-stream";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function loadLocalFiles(): Promise<LocalFile[]> {
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(PUBLIC_DIR, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read ${PUBLIC_DIR}: ${(err as Error).message}`);
  }

  const files: LocalFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolutePath = path.join(PUBLIC_DIR, entry.name);
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) continue;
    files.push({
      absolutePath,
      filename: entry.name,
      blobPathname: `${BLOB_PREFIX}${entry.name}`,
      oldReference: `/brabus-images/${entry.name}`,
      size: stats.size,
      contentType: contentTypeFor(entry.name),
    });
  }
  files.sort((a, b) => a.filename.localeCompare(b.filename));
  return files;
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;

  async function pump() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, pump));
  return results;
}

function progressLine(done: number, total: number, action: string) {
  const pct = ((done / total) * 100).toFixed(1);
  return `[${done}/${total}] ${pct}% ${action}`;
}

async function main() {
  console.log("=== Brabus images → Vercel Blob migration ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);
  console.log(`Concurrency: ${CONCURRENCY}`);

  if (!isBlobStorageConfigured()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local (or pull from Vercel) before running."
    );
  }

  const [localFiles, existingBlobs] = await Promise.all([
    loadLocalFiles(),
    listAllBlobsByPrefix(BLOB_PREFIX),
  ]);

  const existingBlobUrls = new Map<string, string>(existingBlobs.map((b) => [b.pathname, b.url]));

  const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(
    `\nLocal files: ${localFiles.length} (${formatBytes(totalSize)}) under ${PUBLIC_DIR}`
  );
  console.log(`Already in Blob (prefix "${BLOB_PREFIX}"): ${existingBlobs.length}`);

  /* ── 1. Upload missing files to Blob ──────────────────────────────────── */
  const toUpload = localFiles.filter((f) => !existingBlobUrls.has(f.blobPathname));
  console.log(
    `To upload: ${toUpload.length} files (${formatBytes(toUpload.reduce((s, f) => s + f.size, 0))})`
  );

  let lastLog = Date.now();
  let uploaded = 0;
  let uploadFailed = 0;
  const uploadErrors: Array<{ file: string; error: string }> = [];

  if (commit && toUpload.length > 0) {
    await runWithConcurrency(
      toUpload,
      async (file) => {
        try {
          const buffer = await fs.readFile(file.absolutePath);
          const result = await putPublicBlob(file.blobPathname, buffer, file.contentType);
          existingBlobUrls.set(file.blobPathname, result.url);
          uploadedThisRun.add(result.url);
          uploaded += 1;
        } catch (err) {
          uploadFailed += 1;
          uploadErrors.push({
            file: file.filename,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
      CONCURRENCY,
      (done, total) => {
        const now = Date.now();
        if (now - lastLog > 2000 || done === total) {
          process.stdout.write(`\r${progressLine(done, total, "uploaded")}        `);
          lastLog = now;
        }
      }
    );
    process.stdout.write("\n");
  } else if (toUpload.length > 0) {
    console.log(`(dry-run) would upload ${toUpload.length} files to Blob`);
  }

  /* ── 2. Build rewrite map: /brabus-images/foo.jpg → https://...blob.../brabus-images/foo.jpg */
  const rewriteMap = new Map<string, string>();
  for (const file of localFiles) {
    const blobUrl = existingBlobUrls.get(file.blobPathname);
    if (blobUrl) rewriteMap.set(file.oldReference, blobUrl);
  }
  console.log(`\nRewrite mappings ready: ${rewriteMap.size}`);

  /* ── 3. Inspect DB rows that still need rewriting ─────────────────────── */
  const [productCount, mediaCount, variantCount] = await Promise.all([
    prisma.shopProduct.count({ where: { image: { startsWith: "/brabus-images/" } } }),
    prisma.shopProductMedia.count({ where: { src: { startsWith: "/brabus-images/" } } }),
    prisma.shopProductVariant.count({ where: { image: { startsWith: "/brabus-images/" } } }),
  ]);
  console.log(`\nDB rows still pointing at /brabus-images/...:`);
  console.log(`  ShopProduct.image:        ${productCount}`);
  console.log(`  ShopProductMedia.src:     ${mediaCount}`);
  console.log(`  ShopProductVariant.image: ${variantCount}`);

  /* ── 4. Rewrite DB references in batches by exact path ────────────────── */
  if (commit && rewriteMap.size > 0) {
    console.log(`\nRewriting DB references…`);
    const oldReferences = [...rewriteMap.keys()];
    const [products, mediaRows, variants] = await Promise.all([
      prisma.shopProduct.findMany({
        where: { image: { in: oldReferences } },
        select: { id: true, image: true, catalogVersion: true },
      }),
      prisma.shopProductMedia.findMany({
        where: { src: { in: oldReferences } },
        select: {
          id: true,
          src: true,
          productId: true,
          product: { select: { catalogVersion: true } },
        },
      }),
      prisma.shopProductVariant.findMany({
        where: { image: { in: oldReferences } },
        select: {
          id: true,
          image: true,
          productId: true,
          product: { select: { catalogVersion: true } },
        },
      }),
    ]);
    const groups = new Map<
      string,
      {
        catalogVersion: bigint;
        primaryImage?: string;
        media: Array<{ id: string; src: string }>;
        variants: Array<{ id: string; image: string }>;
      }
    >();
    for (const product of products) {
      const next = product.image ? rewriteMap.get(product.image) : null;
      if (!next) continue;
      groups.set(product.id, {
        catalogVersion: product.catalogVersion,
        primaryImage: next,
        media: [],
        variants: [],
      });
    }
    for (const media of mediaRows) {
      const next = rewriteMap.get(media.src);
      if (!next) continue;
      const group = groups.get(media.productId) ?? {
        catalogVersion: media.product.catalogVersion,
        media: [],
        variants: [],
      };
      group.media.push({ id: media.id, src: next });
      groups.set(media.productId, group);
    }
    for (const variant of variants) {
      const next = variant.image ? rewriteMap.get(variant.image) : null;
      if (!next) continue;
      const group = groups.get(variant.productId) ?? {
        catalogVersion: variant.product.catalogVersion,
        media: [],
        variants: [],
      };
      group.variants.push({ id: variant.id, image: next });
      groups.set(variant.productId, group);
    }

    let rewriteDone = 0;
    let productUpdates = 0;
    let mediaUpdates = 0;
    let variantUpdates = 0;
    const catalogOutboxIds: string[] = [];
    lastLog = Date.now();

    for (const [productId, group] of [...groups.entries()].sort(([a], [b]) =>
      a.localeCompare(b, "en")
    )) {
      const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId,
        expectedCatalogVersion: group.catalogVersion.toString(),
        changeDomains: ["MEDIA"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          if (group.primaryImage) {
            await tx.shopProduct.update({
              where: { id: productId },
              data: { image: group.primaryImage },
            });
            productUpdates += 1;
          }
          for (const media of group.media) {
            const updated = await tx.shopProductMedia.updateMany({
              where: { id: media.id, productId },
              data: { src: media.src },
            });
            if (updated.count !== 1) throw new Error(`Media ownership changed for ${media.id}`);
            mediaUpdates += 1;
          }
          for (const variant of group.variants) {
            const updated = await tx.shopProductVariant.updateMany({
              where: { id: variant.id, productId },
              data: { image: variant.image },
            });
            if (updated.count !== 1) throw new Error(`Variant ownership changed for ${variant.id}`);
            variantUpdates += 1;
          }
          return buildShopCatalogAdminSnapshot(tx, productId, nextCatalogVersion, {
            type: "IMPORT",
            id: "brabus-images-migration@system.local",
            reason: "brabus.images.blob-migration",
          });
        },
      });
      catalogOutboxIds.push(mutation.outboxId);
      rewriteDone += 1;
      const now = Date.now();
      if (now - lastLog > 2000 || rewriteDone === groups.size) {
        process.stdout.write(
          `\r${progressLine(rewriteDone, groups.size, "products rewritten")}     `
        );
        lastLog = now;
      }
    }
    process.stdout.write("\n");

    console.log(`  ShopProduct.image rows updated:        ${productUpdates}`);
    console.log(`  ShopProductMedia.src rows updated:     ${mediaUpdates}`);
    console.log(`  ShopProductVariant.image rows updated: ${variantUpdates}`);
    console.log(`  Catalog outbox events:                 ${catalogOutboxIds.length}`);
  } else if (rewriteMap.size > 0) {
    console.log(
      `(dry-run) would rewrite up to ${productCount + mediaCount + variantCount} DB rows`
    );
  }

  /* ── 5. Final summary ─────────────────────────────────────────────────── */
  console.log("\n=== Summary ===");
  console.log(`Local files scanned:    ${localFiles.length}`);
  console.log(`Already in Blob:        ${existingBlobs.length}`);
  console.log(`Uploaded this run:      ${uploaded}`);
  if (uploadFailed > 0) {
    console.log(`Upload failures:        ${uploadFailed}`);
    for (const err of uploadErrors.slice(0, 10)) {
      console.log(`  - ${err.file}: ${err.error}`);
    }
    if (uploadErrors.length > 10) {
      console.log(`  …and ${uploadErrors.length - 10} more`);
    }
  }
  if (dryRun) {
    console.log(`\n(dry-run) — pass --commit to apply.`);
  }

  if (uploadFailed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\nFATAL:", err instanceof Error ? err.stack || err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await cleanupUnreferencedUploads(); }
    catch (error) { console.error(`Orphan cleanup failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; }
    await prisma.$disconnect();
  });
