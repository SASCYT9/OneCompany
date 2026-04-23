import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { atomicWriteTextFile } from '@/lib/adminJsonStorage';
import { matchesHeaderSecret, resolveSecret } from '@/lib/requestSecrets';
import {
  buildMediaLibraryBlobPathname,
  buildStoredFilename,
  decodeBlobBackedAssetId,
  deleteBlob,
  encodeBlobBackedAssetId,
  getRuntimeStorageProvider,
  putPublicBlob,
  listAllBlobsByPrefix,
  type RuntimeStorageProvider,
} from '@/lib/runtimeBlobStorage';
import { inferMediaKind, MEDIA_LIBRARY_PATH_PREFIX } from '@/lib/runtimeAssetPaths';

export type MediaKind = 'image' | 'video' | 'other';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  provider: RuntimeStorageProvider;
  pathname: string;
  filename: string; // stored filename under /public/media
  url: string; // public URL starting with /media
  originalName: string;
  size: number; // bytes
  uploadedAt: string; // ISO timestamp
  checksum?: string;
}

type MediaStorePaths = {
  mediaDir: string;
  manifestPath: string;
};

let mediaMutationQueue: Promise<void> = Promise.resolve();

function resolveMediaStorePaths(): MediaStorePaths {
  // Keep file tracing scoped to the media storage subtree.
  const mediaDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'media');
  return {
    mediaDir,
    manifestPath: path.join(mediaDir, 'media.json'),
  };
}

function withMediaMutationLock<T>(operation: () => Promise<T>) {
  const task = mediaMutationQueue.then(operation, operation);
  mediaMutationQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

async function ensureMediaDir() {
  const { mediaDir, manifestPath } = resolveMediaStorePaths();
  await fs.mkdir(/*turbopackIgnore: true*/ mediaDir, { recursive: true });
  try {
    await fs.access(/*turbopackIgnore: true*/ manifestPath);
  } catch {
    await atomicWriteTextFile(/*turbopackIgnore: true*/ manifestPath, JSON.stringify({ items: [] }, null, 2));
  }
}

export async function getManifest(): Promise<{ items: MediaItem[] }> {
  if (getRuntimeStorageProvider() === 'vercel-blob') {
    return { items: await listMedia() };
  }

  try {
    const { manifestPath } = resolveMediaStorePaths();
    const raw = await fs.readFile(/*turbopackIgnore: true*/ manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.items) return { items: [] };
    return {
      items: (parsed.items as Array<Partial<MediaItem>>).map((item) => {
        const filename = String(item.filename ?? '');
        return {
          id: String(item.id ?? ''),
          kind: (item.kind as MediaKind | undefined) ?? inferMediaKind(filename),
          provider: item.provider === 'vercel-blob' ? 'vercel-blob' : 'local',
          pathname: String(item.pathname ?? buildMediaLibraryBlobPathname(filename)),
          filename,
          url: String(item.url ?? `/media/${filename}`),
          originalName: String(item.originalName ?? filename),
          size: Number(item.size ?? 0),
          uploadedAt: String(item.uploadedAt ?? new Date(0).toISOString()),
          checksum: typeof item.checksum === 'string' ? item.checksum : undefined,
        };
      }),
    };
  } catch {
    return { items: [] };
  }
}

export async function saveManifest(items: MediaItem[]) {
  if (getRuntimeStorageProvider() === 'vercel-blob') {
    return;
  }
  await ensureMediaDir();
  const { manifestPath } = resolveMediaStorePaths();
  await atomicWriteTextFile(/*turbopackIgnore: true*/ manifestPath, JSON.stringify({ items }, null, 2));
}

export function detectKind(mime: string): MediaKind {
  return inferMediaKind(mime);
}

function computeChecksum(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function addMediaFromBuffer(buffer: Buffer, originalName: string, mimeType: string): Promise<MediaItem> {
  if (getRuntimeStorageProvider() === 'vercel-blob') {
    const filename = buildStoredFilename(originalName, mimeType);
    const pathname = buildMediaLibraryBlobPathname(filename);
    const uploaded = await putPublicBlob(pathname, buffer, mimeType);
    return {
      id: encodeBlobBackedAssetId(uploaded.pathname),
      kind: detectKind(mimeType || filename),
      provider: 'vercel-blob',
      pathname: uploaded.pathname,
      filename,
      url: uploaded.url,
      originalName,
      size: buffer.byteLength,
      uploadedAt: new Date().toISOString(),
    };
  }

  return withMediaMutationLock(async () => {
    await ensureMediaDir();
    const { mediaDir } = resolveMediaStorePaths();
    const manifest = await getManifest();
    const checksum = computeChecksum(buffer);
    const duplicate = manifest.items.find((item) => item.checksum === checksum);
    if (duplicate) {
      return duplicate;
    }

    const filename = buildStoredFilename(originalName, mimeType);
    const target = path.join(/*turbopackIgnore: true*/ mediaDir, filename);
    await fs.writeFile(/*turbopackIgnore: true*/ target, buffer);

    const item: MediaItem = {
      id: filename,
      kind: detectKind(mimeType),
      provider: 'local',
      pathname: buildMediaLibraryBlobPathname(filename),
      filename,
      url: `/media/${filename}`,
      originalName,
      size: buffer.byteLength,
      uploadedAt: new Date().toISOString(),
      checksum,
    };

    await saveManifest([item, ...manifest.items]);
    return item;
  });
}

export async function deleteMedia(id: string): Promise<boolean> {
  if (getRuntimeStorageProvider() === 'vercel-blob') {
    try {
      await deleteBlob(decodeBlobBackedAssetId(id));
      return true;
    } catch {
      return false;
    }
  }

  return withMediaMutationLock(async () => {
    await ensureMediaDir();
    const { mediaDir } = resolveMediaStorePaths();
    const manifest = await getManifest();
    const item = manifest.items.find((i) => i.id === id);
    if (!item) return false;
    try {
      await fs.unlink(path.join(/*turbopackIgnore: true*/ mediaDir, item.filename));
    } catch {}
    const next = manifest.items.filter((i) => i.id !== id);
    await saveManifest(next);
    return true;
  });
}

export async function listMedia(): Promise<MediaItem[]> {
  if (getRuntimeStorageProvider() === 'vercel-blob') {
    const blobs = await listAllBlobsByPrefix(MEDIA_LIBRARY_PATH_PREFIX);
    return blobs
      .map((blob) => {
        const filename = path.posix.basename(blob.pathname);
        return {
          id: encodeBlobBackedAssetId(blob.pathname),
          kind: inferMediaKind(filename),
          provider: 'vercel-blob' as const,
          pathname: blob.pathname,
          filename,
          url: blob.url,
          originalName: filename,
          size: blob.size,
          uploadedAt: blob.uploadedAt.toISOString(),
        };
      })
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  }

  const { items } = await getManifest();
  return items;
}

export function requireAdminSecret(req: Request): { ok: boolean; reason?: string } {
  const secret = resolveSecret('ADMIN_SECRET');
  if (!secret) return { ok: false, reason: 'Missing server secret' };
  if (!matchesHeaderSecret(req.headers, 'x-admin-secret', secret)) return { ok: false, reason: 'Unauthorized' };
  return { ok: true };
}
