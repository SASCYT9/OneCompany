import path from 'path';
import { del, list, put, type ListBlobResultBlob, type PutBlobResult } from '@vercel/blob';
import { nanoid } from 'nanoid';
import { MEDIA_LIBRARY_PATH_PREFIX, VIDEO_UPLOADS_PATH_PREFIX } from '@/lib/runtimeAssetPaths';

export type RuntimeStorageProvider = 'local' | 'vercel-blob';

const DEFAULT_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function isBlobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function getRuntimeStorageProvider(): RuntimeStorageProvider {
  return isBlobStorageConfigured() ? 'vercel-blob' : 'local';
}

export function sanitizeBase(name: string) {
  const base = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_\.]/g, '').toLowerCase();
  return base.replace(/\.+/g, '.');
}

export function guessExt(mime: string) {
  if (mime === 'video/mp4') return '.mp4';
  if (mime === 'video/webm') return '.webm';
  if (mime === 'video/ogg') return '.ogg';
  if (mime === 'video/quicktime') return '.mov';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/avif') return '.avif';
  return '';
}

export function buildStoredFilename(originalName: string, mimeType: string) {
  const rawExtension = path.extname(originalName);
  const extension = rawExtension ? rawExtension.toLowerCase() : '';
  const base = sanitizeBase(path.basename(originalName, rawExtension)) || 'asset';
  const suffix = nanoid(10);
  return `${base}-${suffix}${extension || guessExt(mimeType)}`;
}

export function buildMediaLibraryBlobPathname(filename: string) {
  return `${MEDIA_LIBRARY_PATH_PREFIX}${filename}`;
}

export function buildUploadedVideoBlobPathname(filename: string) {
  return `${VIDEO_UPLOADS_PATH_PREFIX}${filename}`;
}

export function encodeBlobBackedAssetId(pathname: string) {
  return Buffer.from(pathname, 'utf8').toString('base64url');
}

export function decodeBlobBackedAssetId(id: string) {
  return Buffer.from(id, 'base64url').toString('utf8');
}

export async function putPublicBlob(
  pathname: string,
  buffer: Buffer,
  contentType: string
): Promise<PutBlobResult> {
  return put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: DEFAULT_CACHE_MAX_AGE_SECONDS,
    contentType,
    multipart: buffer.byteLength >= 10 * 1024 * 1024,
  });
}

export async function deleteBlob(pathnameOrUrl: string) {
  await del(pathnameOrUrl);
}

export async function listAllBlobsByPrefix(prefix: string) {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ cursor, limit: 1000, prefix });
    blobs.push(...page.blobs);
    cursor = page.cursor;
    if (!page.hasMore) {
      break;
    }
  } while (cursor);

  return blobs;
}
