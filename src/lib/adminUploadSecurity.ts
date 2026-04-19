import path from 'path';

export type AdminUploadValidationInput = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  allowedMimeTypes: readonly string[];
  maxBytes: number;
};

function sanitizeNameSegment(value: string, fallback: string) {
  const normalized = value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

export function sanitizeUploadedFilename(originalName: string, fallbackBase = 'upload') {
  const trimmed = String(originalName ?? '').trim();
  const basename = path.basename(trimmed || fallbackBase);
  const parsed = path.parse(basename);
  const safeBase = sanitizeNameSegment(parsed.name, fallbackBase);
  const safeExtension = parsed.ext
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.(?=.)/, '.');

  return `${safeBase}${safeExtension}`;
}

export function validateAdminUpload(input: AdminUploadValidationInput) {
  const mimeType = String(input.mimeType ?? '').trim().toLowerCase();
  const originalName = String(input.originalName ?? '').trim();

  if (!originalName) {
    throw new Error('File name is required');
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error('File is empty');
  }

  if (!mimeType || !input.allowedMimeTypes.includes(mimeType)) {
    throw new Error('Unsupported file type');
  }

  if (input.sizeBytes > input.maxBytes) {
    throw new Error('File is too large');
  }

  const sanitizedFilename = sanitizeUploadedFilename(originalName);
  const extension = path.extname(sanitizedFilename).toLowerCase();

  if (!extension) {
    throw new Error('File extension is required');
  }

  return {
    sanitizedFilename,
    mimeType,
    sizeBytes: input.sizeBytes,
    extension,
  };
}
