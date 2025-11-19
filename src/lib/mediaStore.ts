import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export type MediaKind = 'image' | 'video' | 'other';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  filename: string; // stored filename under /public/media
  url: string; // public URL starting with /media
  originalName: string;
  size: number; // bytes
  uploadedAt: string; // ISO timestamp
}

const projectRoot = process.cwd();
const MEDIA_DIR = path.join(projectRoot, 'public', 'media');
const MANIFEST_PATH = path.join(MEDIA_DIR, 'media.json');

async function ensureMediaDir() {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  try {
    await fs.access(MANIFEST_PATH);
  } catch {
    await fs.writeFile(MANIFEST_PATH, JSON.stringify({ items: [] }, null, 2), 'utf8');
  }
}

export async function getManifest(): Promise<{ items: MediaItem[] }> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.items) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

export async function saveManifest(items: MediaItem[]) {
  await ensureMediaDir();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify({ items }, null, 2), 'utf8');
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

export async function addMediaFromBuffer(buffer: Buffer, originalName: string, mimeType: string): Promise<MediaItem> {
  await ensureMediaDir();
  const ext = (() => {
    const parts = originalName.split('.');
    return parts.length > 1 ? '.' + parts.pop()!.toLowerCase() : '';
  })();
  const id = nanoid(10);
  const base = sanitizeBase(path.basename(originalName, ext));
  const filename = `${base}-${id}${ext || guessExt(mimeType)}`;
  const target = path.join(MEDIA_DIR, filename);
  await fs.writeFile(target, buffer);

  const item: MediaItem = {
    id,
    kind: detectKind(mimeType),
    filename,
    url: `/media/${filename}`,
    originalName,
    size: buffer.byteLength,
    uploadedAt: new Date().toISOString(),
  };

  const manifest = await getManifest();
  await saveManifest([item, ...manifest.items]);
  return item;
}

export async function deleteMedia(id: string): Promise<boolean> {
  await ensureMediaDir();
  const manifest = await getManifest();
  const item = manifest.items.find((i) => i.id === id);
  if (!item) return false;
  try {
    await fs.unlink(path.join(MEDIA_DIR, item.filename));
  } catch {}
  const next = manifest.items.filter((i) => i.id !== id);
  await saveManifest(next);
  return true;
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
  const header = req.headers.get('x-admin-secret') || '';
  const envSecret = process.env.ADMIN_SECRET;
  // In dev, allow fallback secret to ease local testing
  const fallback = process.env.NODE_ENV !== 'production' ? 'dev-admin' : undefined;
  const valid = envSecret || fallback;
  if (!valid) return { ok: false, reason: 'Missing server secret' };
  if (header !== valid) return { ok: false, reason: 'Unauthorized' };
  return { ok: true };
}
