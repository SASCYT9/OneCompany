const HTTP_URL_PATTERN = /^https?:\/\//i;
const BLOB_HOST_SEGMENT = '.blob.vercel-storage.com';

export const MEDIA_LIBRARY_PATH_PREFIX = 'media/library/';
export const VIDEO_UPLOADS_PATH_PREFIX = 'videos/uploads/';

function trimReference(reference: string | null | undefined) {
  return String(reference ?? '').trim();
}

function normalizePublicBasePath(basePath: string) {
  const trimmed = trimReference(basePath).replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function splitReferencePath(reference: string) {
  const [pathname] = reference.split(/[?#]/, 1);
  return pathname || reference;
}

function lastPathSegment(reference: string) {
  const pathname = splitReferencePath(reference).replace(/\/+$/, '');
  const lastSlash = pathname.lastIndexOf('/');
  return lastSlash === -1 ? pathname : pathname.slice(lastSlash + 1);
}

export function isAbsoluteHttpUrl(reference: string | null | undefined) {
  return HTTP_URL_PATTERN.test(trimReference(reference));
}

export function resolveAssetReference(
  reference: string | null | undefined,
  publicBasePath: string
): string | undefined {
  const trimmed = trimReference(reference);
  if (!trimmed) {
    return undefined;
  }

  if (isAbsoluteHttpUrl(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }

  const normalizedBasePath = normalizePublicBasePath(publicBasePath);
  const normalizedBaseSegment = normalizedBasePath.replace(/^\/+/, '');

  if (trimmed.startsWith(`${normalizedBaseSegment}/`)) {
    return `/${trimmed}`;
  }

  return `${normalizedBasePath}/${trimmed.replace(/^\/+/, '')}`;
}

export function resolveVideoAssetReference(reference: string | null | undefined) {
  return resolveAssetReference(reference, '/videos');
}

export function resolveImageAssetReference(reference: string | null | undefined) {
  return resolveAssetReference(reference, '/images');
}

export function extractBlobPathname(reference: string | null | undefined) {
  const trimmed = trimReference(reference);
  if (!trimmed || !isAbsoluteHttpUrl(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.toLowerCase().endsWith(BLOB_HOST_SEGMENT)) {
      return null;
    }
    return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }
}

export function isBlobStorageUrl(reference: string | null | undefined) {
  return Boolean(extractBlobPathname(reference));
}

export function isLibraryBackedAssetReference(reference: string | null | undefined) {
  const trimmed = trimReference(reference);
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('/media/')) {
    return true;
  }

  const blobPathname = extractBlobPathname(trimmed);
  return Boolean(blobPathname?.startsWith(MEDIA_LIBRARY_PATH_PREFIX));
}

export function isUploadedVideoAssetReference(reference: string | null | undefined) {
  const trimmed = trimReference(reference);
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('/videos/uploads/')) {
    return true;
  }

  const blobPathname = extractBlobPathname(trimmed);
  return Boolean(blobPathname?.startsWith(VIDEO_UPLOADS_PATH_PREFIX));
}

export function inferMediaKind(value: string | null | undefined): 'image' | 'video' | 'other' {
  const fullValue = trimReference(value).toLowerCase();
  const normalized = lastPathSegment(fullValue);

  if (
    fullValue.startsWith('image/') ||
    /\.(avif|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(normalized)
  ) {
    return 'image';
  }

  if (
    fullValue.startsWith('video/') ||
    /\.(m4v|mov|mp4|mpeg|mpg|ogg|ogv|webm)$/i.test(normalized)
  ) {
    return 'video';
  }

  return 'other';
}

export function inferVideoMimeType(reference: string | null | undefined) {
  const normalized = lastPathSegment(trimReference(reference)).toLowerCase();
  if (normalized.endsWith('.webm')) return 'video/webm';
  if (normalized.endsWith('.ogg') || normalized.endsWith('.ogv')) return 'video/ogg';
  if (normalized.endsWith('.mov')) return 'video/quicktime';
  if (normalized.endsWith('.m4v')) return 'video/x-m4v';
  if (normalized.endsWith('.mpg') || normalized.endsWith('.mpeg')) return 'video/mpeg';
  return 'video/mp4';
}
