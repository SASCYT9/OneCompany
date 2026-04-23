import { promises as fs } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { readSiteContent, writeSiteContent } from '@/lib/siteContentServer';
import { readSiteMedia, writeSiteMedia } from '@/lib/siteMediaServer';
import { readVideoConfig, writeVideoConfig } from '@/lib/videoConfig';
import {
  MEDIA_LIBRARY_PATH_PREFIX,
  VIDEO_UPLOADS_PATH_PREFIX,
} from '@/lib/runtimeAssetPaths';
import { isBlobStorageConfigured, listAllBlobsByPrefix, putPublicBlob } from '@/lib/runtimeBlobStorage';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const commit = args.has('--commit');
const dryRun = !commit || args.has('--dry-run');

const mediaRoot = path.join(process.cwd(), 'public', 'media');
const videoUploadsRoot = path.join(process.cwd(), 'public', 'videos', 'uploads');

type AssetKind = 'media' | 'video';

type LocalAsset = {
  kind: AssetKind;
  absolutePath: string;
  relativePath: string;
  blobPathname: string;
  contentType: string;
  size: number;
  oldReferences: string[];
};

type UploadedAsset = LocalAsset & {
  action: 'existing' | 'uploaded' | 'pending';
  blobUrl: string | null;
};

type DbRewriteSummary = {
  productPrimaryImages: number;
  productMedia: number;
  variantImages: number;
};

type JsonRewriteSummary = {
  changed: boolean;
  replacements: number;
};

function toPosixPath(value: string) {
  return value.split(path.sep).join('/');
}

function contentTypeFromFilePath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    case '.svg':
      return 'image/svg+xml';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.ogg':
    case '.ogv':
      return 'video/ogg';
    case '.mov':
      return 'video/quicktime';
    case '.m4v':
      return 'video/x-m4v';
    default:
      return 'application/octet-stream';
  }
}

async function walkFiles(rootDir: string, skipFile?: (relativePath: string) => boolean): Promise<LocalAsset[]> {
  const items: LocalAsset[] = [];

  async function visit(currentDir: string, kind: AssetKind) {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toPosixPath(path.relative(rootDir, absolutePath));

      if (entry.isDirectory()) {
        await visit(absolutePath, kind);
        continue;
      }

      if (!relativePath || skipFile?.(relativePath)) {
        continue;
      }

      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        continue;
      }

      if (kind === 'media') {
        items.push({
          kind,
          absolutePath,
          relativePath,
          blobPathname: `${MEDIA_LIBRARY_PATH_PREFIX}${relativePath}`,
          contentType: contentTypeFromFilePath(relativePath),
          size: stats.size,
          oldReferences: [`/media/${relativePath}`],
        });
      } else {
        items.push({
          kind,
          absolutePath,
          relativePath,
          blobPathname: `${VIDEO_UPLOADS_PATH_PREFIX}${relativePath}`,
          contentType: contentTypeFromFilePath(relativePath),
          size: stats.size,
          oldReferences: [
            `uploads/${relativePath}`,
            `/videos/uploads/${relativePath}`,
            `videos/uploads/${relativePath}`,
          ],
        });
      }
    }
  }

  const inferredKind: AssetKind = rootDir === mediaRoot ? 'media' : 'video';
  await visit(rootDir, inferredKind);
  return items.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function loadLocalAssets() {
  const [mediaAssets, videoAssets] = await Promise.all([
    walkFiles(mediaRoot, (relativePath) => relativePath === 'media.json'),
    walkFiles(videoUploadsRoot),
  ]);

  return {
    mediaAssets,
    videoAssets,
    allAssets: [...mediaAssets, ...videoAssets],
  };
}

async function loadExistingBlobUrlMap() {
  const [mediaBlobs, videoBlobs] = await Promise.all([
    listAllBlobsByPrefix(MEDIA_LIBRARY_PATH_PREFIX),
    listAllBlobsByPrefix(VIDEO_UPLOADS_PATH_PREFIX),
  ]);

  return new Map<string, string>(
    [...mediaBlobs, ...videoBlobs].map((blob) => [blob.pathname, blob.url])
  );
}

async function uploadAssets(assets: LocalAsset[], existingBlobUrls: Map<string, string>) {
  const uploadedAssets: UploadedAsset[] = [];
  const rewriteMap = new Map<string, string>();

  for (const asset of assets) {
    const existingUrl = existingBlobUrls.get(asset.blobPathname) ?? null;

    if (existingUrl) {
      for (const reference of asset.oldReferences) {
        rewriteMap.set(reference, existingUrl);
      }
      uploadedAssets.push({ ...asset, action: 'existing', blobUrl: existingUrl });
      continue;
    }

    if (!commit) {
      uploadedAssets.push({ ...asset, action: 'pending', blobUrl: null });
      continue;
    }

    const buffer = await fs.readFile(asset.absolutePath);
    const uploaded = await putPublicBlob(asset.blobPathname, buffer, asset.contentType);
    existingBlobUrls.set(asset.blobPathname, uploaded.url);

    for (const reference of asset.oldReferences) {
      rewriteMap.set(reference, uploaded.url);
    }

    uploadedAssets.push({ ...asset, action: 'uploaded', blobUrl: uploaded.url });
  }

  return { uploadedAssets, rewriteMap };
}

function buildOrderedMappings(rewriteMap: Map<string, string>) {
  return Array.from(rewriteMap.entries())
    .filter(([from, to]) => Boolean(from) && Boolean(to) && from !== to)
    .sort((left, right) => right[0].length - left[0].length);
}

function rewriteStringValue(value: string, orderedMappings: Array<[string, string]>) {
  let nextValue = value;
  let replacements = 0;

  for (const [from, to] of orderedMappings) {
    if (!nextValue.includes(from)) {
      continue;
    }

    const parts = nextValue.split(from);
    replacements += parts.length - 1;
    nextValue = parts.join(to);
  }

  return { value: nextValue, replacements };
}

function rewriteStructuredValue<T>(value: T, orderedMappings: Array<[string, string]>): { value: T; replacements: number } {
  if (typeof value === 'string') {
    return rewriteStringValue(value, orderedMappings) as { value: T; replacements: number };
  }

  if (Array.isArray(value)) {
    let replacements = 0;
    const nextArray = value.map((entry) => {
      const rewritten = rewriteStructuredValue(entry, orderedMappings);
      replacements += rewritten.replacements;
      return rewritten.value;
    });
    return { value: nextArray as T, replacements };
  }

  if (value && typeof value === 'object') {
    let replacements = 0;
    const nextObject = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        const rewritten = rewriteStructuredValue(entry, orderedMappings);
        replacements += rewritten.replacements;
        return [key, rewritten.value];
      })
    );
    return { value: nextObject as T, replacements };
  }

  return { value, replacements: 0 };
}

async function rewriteDbReferences(orderedMappings: Array<[string, string]>): Promise<DbRewriteSummary> {
  const oldReferences = orderedMappings.map(([from]) => from);
  const [productImages, productMedia, variantImages] = await Promise.all([
    prisma.shopProduct.findMany({
      where: { image: { in: oldReferences } },
      select: { image: true },
    }),
    prisma.shopProductMedia.findMany({
      where: { src: { in: oldReferences } },
      select: { src: true },
    }),
    prisma.shopProductVariant.findMany({
      where: { image: { in: oldReferences } },
      select: { image: true },
    }),
  ]);

  const summary: DbRewriteSummary = {
    productPrimaryImages: productImages.length,
    productMedia: productMedia.length,
    variantImages: variantImages.filter((item) => Boolean(item.image)).length,
  };

  if (!commit) {
    return summary;
  }

  for (const [from, to] of orderedMappings) {
    await Promise.all([
      prisma.shopProduct.updateMany({
        where: { image: from },
        data: { image: to },
      }),
      prisma.shopProductMedia.updateMany({
        where: { src: from },
        data: { src: to },
      }),
      prisma.shopProductVariant.updateMany({
        where: { image: from },
        data: { image: to },
      }),
    ]);
  }

  return summary;
}

async function rewriteJsonPayloads(orderedMappings: Array<[string, string]>) {
  const [siteContent, siteMedia, videoConfig] = await Promise.all([
    readSiteContent(),
    readSiteMedia(),
    readVideoConfig(),
  ]);

  const rewrittenSiteContent = rewriteStructuredValue(siteContent, orderedMappings);
  const rewrittenSiteMedia = rewriteStructuredValue(siteMedia, orderedMappings);
  const rewrittenVideoConfig = rewriteStructuredValue(videoConfig, orderedMappings);

  const siteContentSummary: JsonRewriteSummary = {
    changed: rewrittenSiteContent.replacements > 0,
    replacements: rewrittenSiteContent.replacements,
  };
  const siteMediaSummary: JsonRewriteSummary = {
    changed: rewrittenSiteMedia.replacements > 0,
    replacements: rewrittenSiteMedia.replacements,
  };
  const videoConfigSummary: JsonRewriteSummary = {
    changed: rewrittenVideoConfig.replacements > 0,
    replacements: rewrittenVideoConfig.replacements,
  };

  if (commit) {
    if (siteContentSummary.changed) {
      await writeSiteContent(rewrittenSiteContent.value);
    }
    if (siteMediaSummary.changed) {
      await writeSiteMedia(rewrittenSiteMedia.value);
    }
    if (videoConfigSummary.changed) {
      await writeVideoConfig(rewrittenVideoConfig.value);
    }
  }

  return {
    siteContentSummary,
    siteMediaSummary,
    videoConfigSummary,
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function printUploadSummary(uploadedAssets: UploadedAsset[]) {
  const totals = uploadedAssets.reduce(
    (accumulator, asset) => {
      accumulator.assets += 1;
      accumulator.bytes += asset.size;
      if (asset.kind === 'media') {
        accumulator.media += 1;
      } else {
        accumulator.video += 1;
      }
      accumulator[asset.action] += 1;
      return accumulator;
    },
    {
      assets: 0,
      media: 0,
      video: 0,
      bytes: 0,
      existing: 0,
      uploaded: 0,
      pending: 0,
    }
  );

  console.log('');
  console.log(`Assets scanned: ${totals.assets} (${totals.media} media, ${totals.video} uploaded videos)`);
  console.log(`Total size: ${formatBytes(totals.bytes)}`);
  console.log(`Already in Blob: ${totals.existing}`);
  console.log(`Uploaded now: ${totals.uploaded}`);
  if (dryRun) {
    console.log(`Pending upload on --commit: ${totals.pending}`);
  }
}

async function main() {
  if (!isBlobStorageConfigured()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required. Pull Vercel env first, then rerun the migration.');
  }

  const { mediaAssets, videoAssets, allAssets } = await loadLocalAssets();
  const existingBlobUrls = await loadExistingBlobUrlMap();
  const { uploadedAssets, rewriteMap } = await uploadAssets(allAssets, existingBlobUrls);
  const orderedMappings = buildOrderedMappings(rewriteMap);

  const dbSummary = await rewriteDbReferences(orderedMappings);
  const jsonSummary = await rewriteJsonPayloads(orderedMappings);

  console.log(commit ? 'Runtime media Blob migration committed.' : 'Runtime media Blob migration dry-run.');
  printUploadSummary(uploadedAssets);

  console.log('');
  console.log(`Rewrite mappings ready: ${orderedMappings.length}`);
  console.log(`DB rewrites: products=${dbSummary.productPrimaryImages}, media=${dbSummary.productMedia}, variants=${dbSummary.variantImages}`);
  console.log(
    `JSON rewrites: siteContent=${jsonSummary.siteContentSummary.replacements}, siteMedia=${jsonSummary.siteMediaSummary.replacements}, videoConfig=${jsonSummary.videoConfigSummary.replacements}`
  );
  console.log(`Media files discovered: ${mediaAssets.length}`);
  console.log(`Uploaded video files discovered: ${videoAssets.length}`);
}

main()
  .catch((error) => {
    console.error('');
    console.error('Runtime media Blob migration failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
