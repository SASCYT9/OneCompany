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

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  isBlobStorageConfigured,
  listAllBlobsByPrefix,
  putPublicBlob,
} from '@/lib/runtimeBlobStorage';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const commit = args.includes('--commit');
const dryRun = !commit;

const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = Math.max(
  1,
  Math.min(20, parseInt(concurrencyArg?.split('=')[1] ?? '8', 10) || 8),
);

const BLOB_PREFIX = 'brabus-images/';
const PUBLIC_DIR = path.resolve(process.cwd(), 'public', 'brabus-images');

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
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.avif') return 'image/avif';
  return 'application/octet-stream';
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
  onProgress?: (done: number, total: number) => void,
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
  console.log('=== Brabus images → Vercel Blob migration ===');
  console.log(`Mode: ${commit ? 'COMMIT' : 'DRY-RUN (pass --commit to apply)'}`);
  console.log(`Concurrency: ${CONCURRENCY}`);

  if (!isBlobStorageConfigured()) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local (or pull from Vercel) before running.',
    );
  }

  const [localFiles, existingBlobs] = await Promise.all([
    loadLocalFiles(),
    listAllBlobsByPrefix(BLOB_PREFIX),
  ]);

  const existingBlobUrls = new Map<string, string>(
    existingBlobs.map((b) => [b.pathname, b.url]),
  );

  const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(
    `\nLocal files: ${localFiles.length} (${formatBytes(totalSize)}) under ${PUBLIC_DIR}`,
  );
  console.log(`Already in Blob (prefix "${BLOB_PREFIX}"): ${existingBlobs.length}`);

  /* ── 1. Upload missing files to Blob ──────────────────────────────────── */
  const toUpload = localFiles.filter((f) => !existingBlobUrls.has(f.blobPathname));
  console.log(`To upload: ${toUpload.length} files (${formatBytes(toUpload.reduce((s, f) => s + f.size, 0))})`);

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
          process.stdout.write(`\r${progressLine(done, total, 'uploaded')}        `);
          lastLog = now;
        }
      },
    );
    process.stdout.write('\n');
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
    prisma.shopProduct.count({ where: { image: { startsWith: '/brabus-images/' } } }),
    prisma.shopProductMedia.count({ where: { src: { startsWith: '/brabus-images/' } } }),
    prisma.shopProductVariant.count({ where: { image: { startsWith: '/brabus-images/' } } }),
  ]);
  console.log(`\nDB rows still pointing at /brabus-images/...:`);
  console.log(`  ShopProduct.image:        ${productCount}`);
  console.log(`  ShopProductMedia.src:     ${mediaCount}`);
  console.log(`  ShopProductVariant.image: ${variantCount}`);

  /* ── 4. Rewrite DB references in batches by exact path ────────────────── */
  if (commit && rewriteMap.size > 0) {
    console.log(`\nRewriting DB references…`);
    const entries = Array.from(rewriteMap.entries());
    let rewriteDone = 0;
    let productUpdates = 0;
    let mediaUpdates = 0;
    let variantUpdates = 0;
    lastLog = Date.now();

    await runWithConcurrency(
      entries,
      async ([from, to]) => {
        const [p, m, v] = await Promise.all([
          prisma.shopProduct.updateMany({ where: { image: from }, data: { image: to } }),
          prisma.shopProductMedia.updateMany({ where: { src: from }, data: { src: to } }),
          prisma.shopProductVariant.updateMany({ where: { image: from }, data: { image: to } }),
        ]);
        productUpdates += p.count;
        mediaUpdates += m.count;
        variantUpdates += v.count;
        rewriteDone += 1;
        const now = Date.now();
        if (now - lastLog > 2000 || rewriteDone === entries.length) {
          process.stdout.write(
            `\r${progressLine(rewriteDone, entries.length, 'paths rewritten')}     `,
          );
          lastLog = now;
        }
      },
      Math.min(CONCURRENCY, 4),
    );
    process.stdout.write('\n');

    console.log(`  ShopProduct.image rows updated:        ${productUpdates}`);
    console.log(`  ShopProductMedia.src rows updated:     ${mediaUpdates}`);
    console.log(`  ShopProductVariant.image rows updated: ${variantUpdates}`);
  } else if (rewriteMap.size > 0) {
    console.log(`(dry-run) would rewrite up to ${productCount + mediaCount + variantCount} DB rows`);
  }

  /* ── 5. Final summary ─────────────────────────────────────────────────── */
  console.log('\n=== Summary ===');
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
    console.error('\nFATAL:', err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
