import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { atomicWriteTextFile } from '@/lib/adminJsonStorage';
import { matchesHeaderSecret, resolveSecret } from '@/lib/requestSecrets';

export type MediaKind = 'image' | 'video' | 'other';

export interface MediaItem {
  id: string;
  kind: MediaKind;
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
  const projectRoot = process.env.MEDIA_STORE_ROOT || process.cwd();
  const mediaDir = path.join(projectRoot, 'public', 'media');
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
  await fs.mkdir(mediaDir, { recursive: true });
  try {
    await fs.access(manifestPath);
  } catch {
    await atomicWriteTextFile(manifestPath, JSON.stringify({ items: [] }, null, 2));
  }
}

export async function getManifest(): Promise<{ items: MediaItem[] }> {
  try {
    const { manifestPath } = resolveMediaStorePaths();
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.items) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

export async function saveManifest(items: MediaItem[]) {
  await ensureMediaDir();
  const { manifestPath } = resolveMediaStorePaths();
  await atomicWriteTextFile(manifestPath, JSON.stringify({ items }, null, 2));
}

export function detectKind(mime: string): MediaKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

export function sanitizeBase(name: string) {
  const base = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_\.]/g, '').toLowerCase();
  return base.replace(/\.+/g, '.');
}

function computeChecksum(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function addMediaFromBuffer(buffer: Buffer, originalName: string, mimeType: string): Promise<MediaItem> {
  return withMediaMutationLock(async () => {
    await ensureMediaDir();
    const { mediaDir } = resolveMediaStorePaths();
    const manifest = await getManifest();
    const checksum = computeChecksum(buffer);
    const duplicate = manifest.items.find((item) => item.checksum === checksum);
    if (duplicate) {
      return duplicate;
    }

    const ext = (() => {
      const parts = originalName.split('.');
      return parts.length > 1 ? '.' + parts.pop()!.toLowerCase() : '';
    })();
    const id = nanoid(10);
    const base = sanitizeBase(path.basename(originalName, ext));
    const filename = `${base}-${id}${ext || guessExt(mimeType)}`;
    const target = path.join(mediaDir, filename);
    await fs.writeFile(target, buffer);

    const item: MediaItem = {
      id,
      kind: detectKind(mimeType),
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
  return withMediaMutationLock(async () => {
    await ensureMediaDir();
    const { mediaDir } = resolveMediaStorePaths();
    const manifest = await getManifest();
    const item = manifest.items.find((i) => i.id === id);
    if (!item) return false;
    try {
      await fs.unlink(path.join(mediaDir, item.filename));
    } catch {}
    const next = manifest.items.filter((i) => i.id !== id);
    await saveManifest(next);
    return true;
  });
}

export async function listMedia(): Promise<MediaItem[]> {
  const { items } = await getManifest();
  return items;
}

function guessExt(mime: string) {
  if (mime === 'video/mp4') return '.mp4';
  if (mime === 'video/webm') return '.webm';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  return '';
}

export function requireAdminSecret(req: Request): { ok: boolean; reason?: string } {
  const secret = resolveSecret('ADMIN_SECRET');
  if (!secret) return { ok: false, reason: 'Missing server secret' };
  if (!matchesHeaderSecret(req.headers, 'x-admin-secret', secret)) return { ok: false, reason: 'Unauthorized' };
  return { ok: true };
}
